FROM python:3.12 as precheck
RUN pip3 install kubernetes kopf==1.37.3 oisp pycodestyle pylint coverage aiounittest pytimeparse
ADD test/requirements.txt /opt/test/
RUN cd /opt/test && pip3 install -r requirements.txt
ADD *.py /opt/
ADD test/*.py /opt/test/
RUN PYTHONPATH=/opt python3 -m pylint --disable=fixme,R0917,C0103 /opt/*.py
RUN PYTHONPATH=/opt coverage run /opt/test/test_beamservicesoperator.py  && \
PYTHONPATH=/opt coverage run -a  /opt/test/test_tables_and_views.py && \
PYTHONPATH=/opt coverage run -a  /opt/test/test_util.py && \
PYTHONPATH=/opt coverage run -a  /opt/test/test_beamsqlstatementsetoperator.py && \
PYTHONPATH=/opt coverage run -a  /opt/test/test_flink_util.py && \
PYTHONPATH=/opt coverage run -a  /opt/test/test_util.py
RUN coverage report --omit "*/test*" -m --fail-under 80

FROM python:3.12
RUN pip3 install kubernetes python-json-logger==2.0.7 kopf==1.37.3 oisp pytimeparse
COPY --from=precheck /opt/*.py /opt/
WORKDIR /opt
RUN groupadd -r bsoperator && useradd -r -g bsoperator bsoperator

USER bsoperator

CMD kopf run -A --standalone /opt/beamsqlstatementsetoperator.py /opt/flinkpythonudfoperator.py