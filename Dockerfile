# Use an official Node.js LTS (Long Term Support) slim image as a parent.
# Slim images are smaller than full images.
FROM node:18-slim
# You can also use node:20-slim or other versions.

# Install system dependencies needed by 'sharp' (for image processing)
# and 'fluent-ffmpeg' or 'ytdl-core' (for media).
# libvips is a key dependency for 'sharp'.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libvips-dev \
    ffmpeg \
    # Add any other system-level tools if your Node libraries require them
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if you have one)
# This step is done separately to leverage Docker's layer caching.
# If package*.json hasn't changed, Docker can reuse this layer.
COPY package*.json ./

# Install Node.js dependencies defined in package.json
# --omit=dev ensures only production dependencies are installed, making the image smaller.
RUN npm install --omit=dev

# Copy the rest of your application's source code into the container
COPY . .

# Your .env file contains secrets. It's generally NOT recommended to COPY it into a Docker image.
# Instead, inject environment variables when you RUN the container or through your hosting platform.
# For example, if running docker locally: docker run -e TELEGRAM_BOT_TOKEN="yourtoken" your-image-name
# Hosting platforms have sections to set these environment variables.

# Command to run your application when the container starts
CMD [ "node", "index.js" ]