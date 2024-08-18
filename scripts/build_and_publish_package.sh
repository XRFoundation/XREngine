#!/bin/bash
set -e
set -x

STAGE=$1
PACKAGE=$2
DOCKERFILE=$3
START_TIME=$4
REGION=$5
NODE_ENV=$6
DESTINATION_REPO_PROVIDER=$7
PRIVATE_REPO=$8

if [ "$DESTINATION_REPO_PROVIDER" = "aws" ]; then
  if [ "$PRIVATE_REPO" = "true" ]; then
    aws ecr get-login-password --region $REGION | docker login -u AWS --password-stdin $DESTINATION_REPO_URL
    aws ecr describe-repositories --repository-names $DESTINATION_REPO_NAME_STEM-$PACKAGE --region $REGION || aws ecr create-repository --repository-name $DESTINATION_REPO_NAME_STEM-$PACKAGE --region $REGION
  else
    aws ecr-public get-login-password --region us-east-1 | docker login -u AWS --password-stdin $DESTINATION_REPO_URL
    aws ecr-public describe-repositories --repository-names $DESTINATION_REPO_NAME_STEM-$PACKAGE --region us-east-1 || aws ecr-public create-repository --repository-name $DESTINATION_REPO_NAME_STEM-$PACKAGE --region us-east-1
  fi
else
  echo "$DOCKER_HUB_PASSWORD" | docker login -u "$DOCKER_USERNAME" --password-stdin
fi

docker context create etherealengine-$PACKAGE-context
docker buildx create --driver=docker-container etherealengine-$PACKAGE-context --name etherealengine-$PACKAGE --driver-opt "image=moby/buildkit:v0.12.0"

BUILD_START_TIME=$(date +"%d-%m-%yT%H-%M-%S")
echo "Starting ${PACKAGE} build at ${BUILD_START_TIME}"
if [ "$DOCKERFILE" != "client-serve-static" ]; then
  docker buildx build \
    --builder etherealengine-$PACKAGE \
    --push \
    -t $DESTINATION_REPO_URL/$DESTINATION_REPO_NAME_STEM-$PACKAGE:${TAG}__${START_TIME} \
    -t $DESTINATION_REPO_URL/$DESTINATION_REPO_NAME_STEM-$PACKAGE:latest_$STAGE \
    -f dockerfiles/$PACKAGE/Dockerfile-$DOCKERFILE \
    --cache-to type=registry,mode=max,image-manifest=true,ref=$DESTINATION_REPO_URL/$DESTINATION_REPO_NAME_STEM-$PACKAGE:latest_${STAGE}_cache \
    --cache-from type=registry,ref=$DESTINATION_REPO_URL/$DESTINATION_REPO_NAME_STEM-$PACKAGE:latest_${STAGE}_cache \
    --build-arg REPO_URL=$SOURCE_REPO_URL \
    --build-arg REPO_NAME=$SOURCE_REPO_NAME_STEM \
    --build-arg STAGE=$STAGE \
    --build-arg KUBERNETES=$KUBERNETES \
    --build-arg TAG=$TAG \
    --build-arg NODE_ENV=$NODE_ENV \
    --build-arg STORAGE_PROVIDER=$STORAGE_PROVIDER \
    --build-arg STORAGE_CLOUDFRONT_DOMAIN=$STORAGE_CLOUDFRONT_DOMAIN \
    --build-arg STORAGE_CLOUDFRONT_DISTRIBUTION_ID=$STORAGE_CLOUDFRONT_DISTRIBUTION_ID \
    --build-arg STORAGE_S3_STATIC_RESOURCE_BUCKET=$STORAGE_S3_STATIC_RESOURCE_BUCKET \
    --build-arg STORAGE_AWS_ACCESS_KEY_ID=$STORAGE_AWS_ACCESS_KEY_ID \
    --build-arg STORAGE_AWS_ACCESS_KEY_SECRET=$STORAGE_AWS_ACCESS_KEY_SECRET \
    --build-arg STORAGE_AWS_ROLE_ARN=$STORAGE_AWS_ROLE_ARN \
    --build-arg STORAGE_AWS_ENABLE_ACLS=$STORAGE_AWS_ENABLE_ACLS \
    --build-arg STORAGE_S3_REGION=$STORAGE_S3_REGION \
    --build-arg STORAGE_S3_AVATAR_DIRECTORY=$STORAGE_S3_AVATAR_DIRECTORY \
    --build-arg SERVE_CLIENT_FROM_STORAGE_PROVIDER=$SERVE_CLIENT_FROM_STORAGE_PROVIDER \
    --build-arg MYSQL_HOST=$MYSQL_HOST \
    --build-arg MYSQL_USER=$MYSQL_USER \
    --build-arg MYSQL_PORT=$MYSQL_PORT \
    --build-arg MYSQL_PASSWORD=$MYSQL_PASSWORD \
    --build-arg MYSQL_DATABASE=$MYSQL_DATABASE \
    --build-arg VITE_APP_HOST=$VITE_APP_HOST \
    --build-arg VITE_APP_PORT=$VITE_APP_PORT \
    --build-arg VITE_PWA_ENABLED=$VITE_PWA_ENABLED \
    --build-arg VITE_SERVER_HOST=$VITE_SERVER_HOST \
    --build-arg VITE_SERVER_PORT=$VITE_SERVER_PORT \
    --build-arg VITE_FEATHERS_STORE_KEY=$VITE_FEATHERS_STORE_KEY \
    --build-arg VITE_FILE_SERVER=$VITE_FILE_SERVER \
    --build-arg VITE_MEDIATOR_SERVER=$VITE_MEDIATOR_SERVER \
    --build-arg VITE_LOGIN_WITH_WALLET=$VITE_LOGIN_WITH_WALLET \
    --build-arg VITE_8TH_WALL=$VITE_8TH_WALL \
    --build-arg VITE_INSTANCESERVER_HOST=$VITE_INSTANCESERVER_HOST \
    --build-arg VITE_INSTANCESERVER_PORT=$VITE_INSTANCESERVER_PORT \
    --build-arg VITE_LOCAL_BUILD=$VITE_LOCAL_BUILD \
    --build-arg VITE_SOURCEMAPS=$VITE_SOURCEMAPS \
    --build-arg VITE_READY_PLAYER_ME_URL=$VITE_READY_PLAYER_ME_URL \
    --build-arg VITE_DISABLE_LOG=$VITE_DISABLE_LOG \
    --build-arg VITE_AVATURN_URL=$VITE_AVATURN_URL \
    --build-arg VITE_AVATURN_API=$VITE_AVATURN_API \
    --build-arg VITE_ZENDESK_ENABLED=$VITE_ZENDESK_ENABLED \
    --build-arg VITE_ZENDESK_KEY=$VITE_ZENDESK_KEY \
    --build-arg VITE_ZENDESK_AUTHENTICATION_ENABLED=$VITE_ZENDESK_AUTHENTICATION_ENABLED .
else
  docker buildx build \
    --builder etherealengine-$PACKAGE \
    -f dockerfiles/$PACKAGE/Dockerfile-$DOCKERFILE \
    --cache-to type=registry,mode=max,image-manifest=true,ref=$DESTINATION_REPO_URL/$DESTINATION_REPO_NAME_STEM-$PACKAGE:latest_${STAGE}_cache \
    --cache-from type=registry,ref=$DESTINATION_REPO_URL/$DESTINATION_REPO_NAME_STEM-$PACKAGE:latest_${STAGE}_cache \
    --build-arg REPO_URL=$SOURCE_REPO_URL \
    --build-arg REPO_NAME=$SOURCE_REPO_NAME_STEM \
    --build-arg STAGE=$STAGE \
    --build-arg KUBERNETES=$KUBERNETES \
    --build-arg TAG=$TAG \
    --build-arg NODE_ENV=$NODE_ENV \
    --build-arg STORAGE_PROVIDER=$STORAGE_PROVIDER \
    --build-arg STORAGE_CLOUDFRONT_DOMAIN=$STORAGE_CLOUDFRONT_DOMAIN \
    --build-arg STORAGE_CLOUDFRONT_DISTRIBUTION_ID=$STORAGE_CLOUDFRONT_DISTRIBUTION_ID \
    --build-arg STORAGE_S3_STATIC_RESOURCE_BUCKET=$STORAGE_S3_STATIC_RESOURCE_BUCKET \
    --build-arg STORAGE_AWS_ACCESS_KEY_ID=$STORAGE_AWS_ACCESS_KEY_ID \
    --build-arg STORAGE_AWS_ACCESS_KEY_SECRET=$STORAGE_AWS_ACCESS_KEY_SECRET \
    --build-arg STORAGE_AWS_ROLE_ARN=$STORAGE_AWS_ROLE_ARN \
    --build-arg STORAGE_AWS_ENABLE_ACLS=$STORAGE_AWS_ENABLE_ACLS \
    --build-arg STORAGE_S3_REGION=$STORAGE_S3_REGION \
    --build-arg STORAGE_S3_AVATAR_DIRECTORY=$STORAGE_S3_AVATAR_DIRECTORY \
    --build-arg SERVE_CLIENT_FROM_STORAGE_PROVIDER=$SERVE_CLIENT_FROM_STORAGE_PROVIDER \
    --build-arg MYSQL_HOST=$MYSQL_HOST \
    --build-arg MYSQL_USER=$MYSQL_USER \
    --build-arg MYSQL_PORT=$MYSQL_PORT \
    --build-arg MYSQL_PASSWORD=$MYSQL_PASSWORD \
    --build-arg MYSQL_DATABASE=$MYSQL_DATABASE \
    --build-arg VITE_APP_HOST=$VITE_APP_HOST \
    --build-arg VITE_APP_PORT=$VITE_APP_PORT \
    --build-arg VITE_PWA_ENABLED=$VITE_PWA_ENABLED \
    --build-arg VITE_SERVER_HOST=$VITE_SERVER_HOST \
    --build-arg VITE_SERVER_PORT=$VITE_SERVER_PORT \
    --build-arg VITE_FEATHERS_STORE_KEY=$VITE_FEATHERS_STORE_KEY \
    --build-arg VITE_FILE_SERVER=$VITE_FILE_SERVER \
    --build-arg VITE_MEDIATOR_SERVER=$VITE_MEDIATOR_SERVER \
    --build-arg VITE_LOGIN_WITH_WALLET=$VITE_LOGIN_WITH_WALLET \
    --build-arg VITE_8TH_WALL=$VITE_8TH_WALL \
    --build-arg VITE_INSTANCESERVER_HOST=$VITE_INSTANCESERVER_HOST \
    --build-arg VITE_INSTANCESERVER_PORT=$VITE_INSTANCESERVER_PORT \
    --build-arg VITE_LOCAL_BUILD=$VITE_LOCAL_BUILD \
    --build-arg VITE_SOURCEMAPS=$VITE_SOURCEMAPS \
    --build-arg VITE_READY_PLAYER_ME_URL=$VITE_READY_PLAYER_ME_URL \
    --build-arg VITE_DISABLE_LOG=$VITE_DISABLE_LOG \
    --build-arg VITE_AVATURN_URL=$VITE_AVATURN_URL \
    --build-arg VITE_AVATURN_API=$VITE_AVATURN_API \
    --build-arg VITE_ZENDESK_ENABLED=$VITE_ZENDESK_ENABLED \
    --build-arg VITE_ZENDESK_KEY=$VITE_ZENDESK_KEY \
    --build-arg VITE_ZENDESK_AUTHENTICATION_ENABLED=$VITE_ZENDESK_AUTHENTICATION_ENABLED .
fi

BUILD_END_TIME=$(date +"%d-%m-%yT%H-%M-%S")
echo "${PACKAGE} build started at ${BUILD_START_TIME}, ended at ${BUILD_END_TIME}"
