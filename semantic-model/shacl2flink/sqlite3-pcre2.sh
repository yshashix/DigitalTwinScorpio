#! /bin/bash

sudo mkdir -p /usr/lib/sqlite3
# Install sqlite3-pcre2 loadable library on location /usr/lib/sqlite3/pcre2.so 
# Using Christian proust repos which is forked from original sqlite3-pcre code return from Alexey Tourbin <at@altlinux.ru> 
git clone https://github.com/christian-proust/sqlite3-pcre2.git
cd sqlite3-pcre2
make
make install