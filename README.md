# Vault

A simple image storage service built with Node.js, Express, and MongoDB. Securely store and retrieve your images using GridFS technology.

## Features

- Image upload via drag & drop interface
- Secure storage in MongoDB using GridFS for efficient handling of large files
- Fast image retrieval and display with proper content types
- File validation and security:
  - Supported formats: JPEG, PNG, GIF
  - Size limit: 5MB per image
  - File type verification
- Rate limiting to prevent API abuse
- Error handling and logging

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
```

Required environment variables:
- `PORT`: Application port (default: 3000)
- `MONGO_URI`: MongoDB connection string
- `RATE_LIMIT_WINDOW_MS`: Rate limit window in milliseconds
- `RATE_LIMIT_MAX`: Maximum requests per window

3. Start MongoDB and the application using Docker:
```bash
docker-compose up
```

The application will be available at `http://localhost:3000`

## API Endpoints

### Upload Image
```http
POST /upload
Content-Type: multipart/form-data

Body:
- image: File (required)

Response:
{
  "message": "Image uploaded successfully",
  "file": {
    "filename": string,
    "originalName": string,
    "uploadDate": date,
    "size": number,
    "id": string
  }
}
```

### Retrieve Image
```http
GET /image/:id

Response:
- Image file with appropriate content-type
- 404 if image not found
```

## Technical Details

- **File Types**: JPEG, PNG, GIF
- **Max File Size**: 5MB
- **Storage**: MongoDB GridFS for efficient large file handling
- **Rate Limiting**: 100 requests per minute
- **Error Handling**: Proper error responses for:
  - Invalid file types
  - File size exceeded
  - Server errors
  - Missing files

## Development

Start the application in development mode with hot reload:
```bash
npm run dev
```

## Docker Support

The application includes Docker configuration for easy deployment:
- Node.js application container
- MongoDB container with persistent storage
- Automatic container orchestration 