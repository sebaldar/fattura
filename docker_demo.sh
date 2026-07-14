#!/bin/sh
docker compose -f docker-compose.demo.yml --env-file .env.demo up -d --build
