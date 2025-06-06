/**
* Copyright (c) 2017, 2020, 2024 Intel Corporation
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

const utils = require('../lib/utils');

/* Example. NGSI-LD format for Relationship"
*
{
    “id”: “urn:plasmacutter:1\\https://industry-fusion.com/types/v0.9/hasFilter”,
    “entityId”: “urn:plasmacutter:1”,
    “name”: “https://industry-fusion.com/types/v0.9/hasFilter”,
    “type”: “https://uri.etsi.org/ngsi-ld/Relationship”,
    “attributeValue”: “urn:filter:1”,
    “nodeType”: “@id”,
    “index”: 0
}
*/

/* Example NGSI-LD format for Property|LiteralProperty
{
    “id”: “urn:plasmacutter:1\\https://industry-fusion.com/types/v0.9/hasFilter”,
    “entityId”: “urn:plasmacutter:1”,
    “name”: “https://industry-fusion.com/types/v0.9/hasFilter”,
    “type”: “https://uri.etsi.org/ngsi-ld/Property”,
    “attributeValue”: “literal”,
    “nodeType”: “@value”,
    “index”: 0
}
*/
/* Example NGSI-LD format for IriProperty
{
    “id”: “urn:plasmacutter:1\\https://industry-fusion.com/types/v0.9/hasClass”,
    “entityId”: “urn:plasmacutter:1”,
    “name”: “https://industry-fusion.com/types/v0.9/hasFilter”,
    “type”: “https://uri.etsi.org/ngsi-ld/Property”,
    “attributeValue”: “http://example.com/term”,
    “nodeType”: “@id”,
    “index”: 0
}
*/
/* Example NGSI-LD format for JsonProperty
{
    “id”: “urn:plasmacutter:1\\https://industry-fusion.com/types/v0.9/hasClass”,
    “entityId”: “urn:plasmacutter:1”,
    “name”: “https://industry-fusion.com/types/v0.9/hasFilter”,
    “type”: “https://uri.etsi.org/ngsi-ld/JsonProperty”,
    “attributeValue”: “{\"my\": \"object\"}”,
    “nodeType”: “@json”,
    “index”: 0
}
*/
/* Example NGSI-LD format for ListProperty
{
    “id”: “urn:plasmacutter:1\\https://industry-fusion.com/types/v0.9/hasClass”,
    “entityId”: “urn:plasmacutter:1”,
    “name”: “https://industry-fusion.com/types/v0.9/hasFilter”,
    “type”: “https://uri.etsi.org/ngsi-ld/ListProperty”,
    “attributeValue”: “[1, 2, 3]”,
    “nodeType”: “@list”,
    “index”: 0
}
*/
/**
 *  Example Received metric:
 *
 * {"timestamp":1655974018778,"
metrics":
    [{
    "name":"Relationship/https://industry-fusion.com/types/v0.9/hasFilter",
    "alias":"fbb3b7cd-a5ff-491b-ad61-d43edf513b7a",
    "timestamp":1655974018777,
    "dataType":"string",
    "value":"urn:filter:1"}],
"seq":2},
{
    "name":"Property/https://industry-fusion.com/types/v0.9/hasState",
    "alias":"fbb3b7cd-a5ff-491b-ad61-d43edf513b7b",
    "timestamp":1655974018778,
    "dataType":"string",
    "value":"literal"}],
"seq":7},
{
    "name":"IriProperty/https://industry-fusion.com/types/v0.9/hasFilter",
    "alias":"fbb3b7cd-a5ff-491b-ad61-d43edf513b7a",
    "timestamp":1655974018777,
    "dataType":"string",
    "value":"http://example.com/iri"}],
"seq":2},
{
    "name":"JsonProperty/https://industry-fusion.com/types/v0.9/hasFilter",
    "alias":"fbb3b7cd-a5ff-491b-ad61-d43edf513b7a",
    "timestamp":1655974018777,
    "dataType":"string",
    "properties": {"keys": ["datasetId"], "values": ["urn"]},
    "value":"{\"my\":\"object\"}"}],
"seq":2}
}

 */

const etsiNgsiRelationshipUrl = 'https://uri.etsi.org/ngsi-ld/Relationship';
const etsiNgsiPropertysUrl = 'https://uri.etsi.org/ngsi-ld/Property';
const etsiNgsiJsonPropertysUrl = 'https://uri.etsi.org/ngsi-ld/JsonProperty';
const etsiNgsiListPropertysUrl = 'https://uri.etsi.org/ngsi-ld/ListProperty';

function addProperties (message, metric) {
  if ('properties' in metric) {
    if ('keys' in metric.properties && 'values' in metric.properties &&
        Array.isArray(metric.properties.keys) && Array.isArray(metric.properties.values)) {
      const index = metric.properties.keys.indexOf('datasetId');
      if (index !== -1 && index < metric.properties.values.length) {
        const value = metric.properties.values[index];
        message.datasetId = value;
      }
      const langIndex = metric.properties.keys.indexOf('lang');
      if (langIndex !== -1 && langIndex < metric.properties.values.length) {
        const value = metric.properties.values[langIndex];
        message.lang = value;
      }
    }
  }

  if (!('datasetId' in message)) {
    message.datasetId = '@none';
  }
}

module.exports.mapSpbRelationshipToKafka = function (deviceId, metric) {
  const originalName = metric.name.substr(metric.name.indexOf('/') + 1);
  const mappedKafkaMessage = {
    entityId: deviceId,
    name: originalName,
    type: etsiNgsiRelationshipUrl,
    attributeValue: metric.value,
    nodeType: '@id'
  };
  addProperties(mappedKafkaMessage, metric);
  const hash = utils.hashString(utils.getCanonicalName(originalName, mappedKafkaMessage.datasetId));
  mappedKafkaMessage.id = `${deviceId}\\${hash}`;
  return mappedKafkaMessage;
};

module.exports.mapSpbPropertyToKafka = function (deviceId, metric) {
  const originalName = metric.name.substr(metric.name.indexOf('/') + 1);
  const mappedPropKafkaMessage = {
    entityId: deviceId,
    nodeType: '@value',
    name: originalName,
    type: etsiNgsiPropertysUrl,
    attributeValue: metric.value
  };
  addProperties(mappedPropKafkaMessage, metric);
  const hash = utils.hashString(utils.getCanonicalName(originalName, mappedPropKafkaMessage.datasetId));
  mappedPropKafkaMessage.id = `${deviceId}\\${hash}`;
  return mappedPropKafkaMessage;
};

module.exports.mapSpbPropertyIriToKafka = function (deviceId, metric) {
  const originalName = metric.name.substr(metric.name.indexOf('/') + 1);
  const mappedPropKafkaMessage = {
    entityId: deviceId,
    nodeType: '@id',
    name: originalName,
    type: etsiNgsiPropertysUrl,
    attributeValue: metric.value
  };
  addProperties(mappedPropKafkaMessage, metric);
  const hash = utils.hashString(utils.getCanonicalName(originalName, mappedPropKafkaMessage.datasetId));
  mappedPropKafkaMessage.id = `${deviceId}\\${hash}`;
  return mappedPropKafkaMessage;
};

module.exports.mapSpbPropertyJsonToKafka = function (deviceId, metric) {
  const originalName = metric.name.substr(metric.name.indexOf('/') + 1);
  const mappedPropKafkaMessage = {
    entityId: deviceId,
    nodeType: '@json',
    name: originalName,
    type: etsiNgsiJsonPropertysUrl,
    attributeValue: metric.value
  };
  addProperties(mappedPropKafkaMessage, metric);
  const hash = utils.hashString(utils.getCanonicalName(originalName, mappedPropKafkaMessage.datasetId));
  mappedPropKafkaMessage.id = `${deviceId}\\${hash}`;
  return mappedPropKafkaMessage;
};

module.exports.mapSpbPropertyListToKafka = function (deviceId, metric) {
  const originalName = metric.name.substr(metric.name.indexOf('/') + 1);
  const mappedPropKafkaMessage = {
    entityId: deviceId,
    nodeType: '@list',
    name: originalName,
    type: etsiNgsiListPropertysUrl,
    attributeValue: metric.value
  };
  addProperties(mappedPropKafkaMessage, metric);
  const hash = utils.hashString(utils.getCanonicalName(originalName, mappedPropKafkaMessage.datasetId));
  mappedPropKafkaMessage.id = `${deviceId}\\${hash}`;
  return mappedPropKafkaMessage;
};
