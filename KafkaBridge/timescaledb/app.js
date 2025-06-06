/**
* Copyright (c) 2023, 2024 Intel Corporation
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*    http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
'use strict';

const GROUPID = 'timescaledbkafkabridge';
const CLIENTID = 'timescaledbkafkaclient';
const { Kafka } = require('kafkajs');
const fs = require('fs');
const config = require('../config/config.json');
const sequelize = require('./utils/tsdb-connect'); // Import sequelize object, Database connection pool managed by Sequelize.
const { QueryTypes } = require('sequelize');
const Logger = require('../lib/logger.js');
const attributeHistoryTable = require('./model/attribute_history.js'); // Import attributeHistory model/table defined
const entityHistoryTable = require('./model/entity_history.js'); // Import entityHistory model/table defined
const attributeHistoryTableName = config.timescaledb.attributeTablename;
const entityHistoryTableName = config.timescaledb.entityTablename;
const runningAsMain = require.main === module;
const logger = new Logger(config);

const kafka = new Kafka({
  clientId: CLIENTID,
  brokers: config.kafka.brokers
});
const consumer = kafka.consumer({ groupId: GROUPID, allowAutoTopicCreation: false });
const processMessage = function ({ topic, partition, message }) {
  if (topic === config.timescaledb.attributeTopic) {
    processAttributeMessage(message);
  } else if (topic === config.timescaledb.entityTopic) {
    processEntityMessage(message);
  }
};

const processAttributeMessage = function (message) {
  try {
    const body = JSON.parse(message.value);
    if (body.type === undefined) {
      return;
    }
    const datapoint = {};
    const kafkaTimestamp = Number(message.timestamp);
    const epochDate = new Date(kafkaTimestamp);
    const utcTime = epochDate.toISOString();

    // Creating datapoint which will be inserted to tsdb
    datapoint.id = body.id;
    datapoint.observedAt = utcTime;
    datapoint.modifiedAt = utcTime;
    datapoint.entityId = body.entityId;
    datapoint.attributeId = body.name;
    datapoint.nodeType = body.nodeType;
    datapoint.deleted = false;
    if ('deleted' in body) {
      datapoint.deleted = body.deleted;
    }
    if ('datasetId' in body) {
      datapoint.datasetId = body.datasetId;
    } else {
      datapoint.datasetId = '@none';
    }
    if ('unitCode' in body) {
      datapoint.unitCode = body.unitCode;
    }
    if ('lang' in body) {
      datapoint.lang = body.lang;
    }
    if ('parentId' in body) {
      datapoint.parentId = body.parentId;
    }
    if (body.type === 'https://uri.etsi.org/ngsi-ld/Property' || body.type === 'https://uri.etsi.org/ngsi-ld/GeoProperty') {
      let value = body.attributeValue;
      if (!isNaN(value)) {
        value = Number(value);
      }
      datapoint.attributeType = body.type;
      datapoint.value = value;
      if (body.valueType !== undefined && body.valueType !== null) {
        datapoint.valueType = body.valueType;
      }
    } else if (body.type === 'https://uri.etsi.org/ngsi-ld/Relationship') {
      datapoint.attributeType = body.type;
      datapoint.value = body.attributeValue;
    } else if (body.type === 'https://uri.etsi.org/ngsi-ld/JsonProperty' || body.type === 'https://uri.etsi.org/ngsi-ld/ListProperty') {
      datapoint.attributeType = body.type;
      datapoint.value = body.attributeValue;
    } else {
      logger.error('Could not send Datapoints: Neither Property, GeoProperty nor Relationship');
      return;
    }
    attributeHistoryTable.upsert(datapoint).then(() => {
      logger.debug('Datapoint succefully stored in tsdb table');
    }).catch((err) => {
      logger.error('Error in storing datapoint in tsdb: ' + JSON.stringify(err));
      // if (err.name === 'AssertionError') {
      //   logger.error("In AssertionError")
      //   throw err;
      // }
    });
  } catch (e) {
    logger.error('could not process message: ' + e.stack);
  }
};

const processEntityMessage = function (message) {
  try {
    const body = JSON.parse(message.value);
    if (body.type === undefined) {
      return;
    }
    const entity = {};
    const kafkaTimestamp = Number(message.timestamp);
    const epochDate = new Date(kafkaTimestamp);
    const utcTime = epochDate.toISOString();

    // Creating datapoint which will be inserted to tsdb
    entity.id = body.id;
    entity.observedAt = utcTime;
    entity.modifiedAt = utcTime;
    entity.type = body.type;
    entity.deleted = false;
    if (body.deleted !== null && body.deleted !== undefined) {
      entity.deleted = body.deleted;
    }
    entityHistoryTable.upsert(entity).then(() => {
      logger.debug('Entity succefully stored in entity table');
    }).catch((err) => logger.error('Error in storing entity in tsdb: ' + err));
  } catch (e) {
    logger.error('could not process message: ' + e.stack);
  }
};

const startListener = async function () {
  let hypertableStatus = false;
  sequelize.authenticate().then(() => {
    logger.info('TSDB connection has been established.');
  })
    .catch(error => {
      logger.error('Unable to connect to TSDB:', error);
      process.exit(1);
    });

  await sequelize.sync().then(() => {
    logger.debug('Succesfully created/synced timescaledb tables ' + attributeHistoryTableName + ' and ' + entityHistoryTableName);
  })
    .catch(error => {
      logger.error('Unable to create/sync table in timescaledb:', error);
    });

  const createUserQuery = 'CREATE ROLE ' + config.timescaledb.tsdbuser + ';';
  await sequelize.query(createUserQuery, { type: QueryTypes.SELECT }).then(() => {
    logger.info('User ' + config.timescaledb.tsdbuser + 'created');
  }).catch(error => {
    logger.warn('Cannot create user, probably already existing.', error);
  });

  const grantUserQuery = 'GRANT SELECT ON ALL TABLES IN SCHEMA public TO ' + config.timescaledb.tsdbuser + ';';
  await sequelize.query(grantUserQuery, { type: QueryTypes.SELECT }).then(() => {
    logger.info('Granted access to user ' + config.timescaledb.tsdbuser);
  }).catch(error => {
    logger.warn('Cannot grant access to user.', error);
  });
  // check hypertable
  const checkHypertable = async function (tablename) {
    const htChecksqlquery = 'SELECT * FROM timescaledb_information.hypertables WHERE hypertable_name = \'' + tablename + '\';';
    await sequelize.query(htChecksqlquery, { type: QueryTypes.SELECT }).then((hypertableInfo) => {
      if (hypertableInfo.length) {
        hypertableStatus = true;
      }
    })
      .catch(error => {
        logger.warn('Hypertable was not created, creating one', error);
      });

    if (!hypertableStatus) {
      const htCreateSqlquery = 'SELECT create_hypertable(\'' + tablename + '\', \'observedAt\', migrate_data => true);';
      await sequelize.query(htCreateSqlquery, { type: QueryTypes.SELECT }).then((hyperTableCreate) => {
        logger.debug('Hypertable created, return from sql query: ' + JSON.stringify(hyperTableCreate));
      })
        .catch(error => {
          logger.error('Unable to create hypertable', error);
        });
    };
  };
  await checkHypertable(attributeHistoryTableName);
  await checkHypertable(entityHistoryTableName);
  // Kafka topic subscription
  await consumer.connect();
  await consumer.subscribe({ topic: config.timescaledb.attributeTopic, fromBeginning: false });
  await consumer.subscribe({ topic: config.timescaledb.entityTopic, fromBeginning: false });
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => processMessage({ topic, partition, message })
  }).catch(e => console.error(`[example/consumer] ${e.message}`, e));

  const errorTypes = ['unhandledRejection', 'uncaughtException'];
  const signalTraps = ['SIGTERM', 'SIGINT', 'SIGUSR2'];

  errorTypes.map(type =>
    process.on(type, async e => {
      try {
        console.log(`process.on ${type}`);
        console.error(e);
        await consumer.disconnect();
        process.exit(0);
      } catch (_) {
        process.exit(1);
      }
    }));

  signalTraps.map(type =>
    process.once(type, async () => {
      try {
        await consumer.disconnect();
      } finally {
        process.kill(process.pid, type);
      }
    }));

  try {
    fs.writeFileSync('/tmp/ready', 'ready');
    fs.writeFileSync('/tmp/healthy', 'healthy');
  } catch (err) {
    logger.error(err);
  }
};

if (runningAsMain) {
  logger.info('Now staring Kafka listener');
  startListener();
}
