#!/bin/sh -e

table="florin_migrations"

dbmate -d migrations --migrations-table "$table" -u "$1" up