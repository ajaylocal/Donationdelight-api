# Bun + Hono API Starter

A modern, high-performance API starter template using [Bun](https://bun.sh), [Hono](https://hono.dev), [MongoDB](https://mongodb.com), and TypeScript.

## Features

- ⚡️ **Ultra-fast performance** with Bun runtime
- 🔄 **Hot reloading** for fast development cycles
- 🧩 **Modular architecture** for scalability
- 🔒 **Built-in authentication** middleware and JWT support
- 🚦 **Request validation** for robust API design
- 🗃️ **MongoDB integration** with Mongoose
- 📦 **Compression support** for optimized responses
- ✅ **TypeScript** for type safety
- 🔍 **Error handling** middleware

## Table of Contents

- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Configuration](#configuration)
- [Usage](#usage)
  - [Development](#development)
  - [Production](#production)
- [API Routes](#api-routes)
- [User Model](#user-model)
- [Project Structure](#project-structure)
- [Changelog](#changelog)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

## Getting Started

### Prerequisites

Before you begin, make sure you have the following installed:

- [Bun](https://bun.sh) (v1.0.0 or newer)
- [MongoDB](https://mongodb.com) or [MongoDB Atlas](https://www.mongodb.com/atlas/database)

### Installation

1. Clone this repository:

```bash
git clone https://github.com/ProMehedi/bun-hono-api-starter.git
cd bun-hono-api-starter
```

2. Install dependencies:

```bash
bun install
```

### Configuration

Create a `.env` file in the root directory with the following variables:

```
PORT=8000
MONGO_URI=mongodb://localhost:27017/bun-hono-api
JWT_SECRET=your_jwt_secret_key
```

## Usage

### Development

Run the development server with hot reloading:

```bash
bun dev
```

### Production

Start the production server:

```bash
bun start
```

## API Routes

| Method | Route                   | Description         | Auth Required | Admin Only |
| ------ | ----------------------- | ------------------- | ------------- | ---------- |
| GET    | `/api/v1`               | API welcome message | No            | No         |
| POST   | `/api/v1/users`         | Create a new user   | No            | No         |
| POST   | `/api/v1/users/login`   | User login          | No            | No         |
| GET    | `/api/v1/users/profile` | Get user profile    | Yes           | No         |
| PUT    | `/api/v1/users/profile` | Update user profile | Yes           | No         |
| GET    | `/api/v1/users`         | Get all users       | Yes           | Yes        |
| GET    | `/api/v1/users/:id`     | Get user by ID      | Yes           | Yes        |

### Request/Response Examples

**Create User:**

```
POST /api/v1/users
```

```json
{
  "name": "Mehedi Hasan",
  "email": "mehedi@example.com",
  "password": "123456"
}
```

**User Login:**

```
POST /api/v1/users/login
```

```json
{
  "email": "mehedi@example.com",
  "password": "123456"
}
```

**Update Profile:**

```
PUT /api/v1/users/profile
```

```json
{
  "name": "Updated Name",
  "email": "updated@example.com",
  "password": "newpassword" // Optional
}
```

**Protected Routes:**
Include the JWT token in the Authorization header:

```
Authorization: Bearer your_jwt_token
```

## User Model

The user model includes the following properties:

```typescript
interface IUser extends Document {
  _id: Schema.Types.ObjectId
  name: string
  email: string
  password: string
  isAdmin: boolean
  matchPassword: (pass: string) => Promise<boolean>
}
```

Key features:

- Password hashing with Bun's built-in password utilities
- Automatic email validation (must match email pattern)
- Admin role support with the `isAdmin` property
- Password matching method for authentication

## Project Structure

```
├── config/              # Configuration files
│   ├── compress.config.ts  # Compression configuration
│   ├── db.config.ts     # Database configuration
│   └── index.ts         # Config exports
├── controllers/         # Route controllers
│   ├── user.controllers.ts # User-related controllers
│   └── index.ts         # Controller exports
├── middlewares/         # Express middlewares
│   ├── auth.middlewares.ts # Authentication middleware
│   ├── error.middlewares.ts # Error handling middleware
│   └── index.ts         # Middleware exports
├── models/              # Database models
│   ├── user.model.ts    # User model schema
│   └── index.ts         # Model exports
├── routes/              # API routes
│   ├── user.routes.ts   # User routes
│   └── index.ts         # Route exports
├── utils/               # Utility functions
│   ├── genToken.ts      # JWT token generator
│   └── index.ts         # Utils exports
├── server.ts            # Main application entry
├── .env                 # Environment variables (create this)
├── .gitignore           # Git ignore file
├── bun.lock             # Bun lock file
├── package.json         # Package configuration
├── README.md            # This file
├── tsconfig.json        # TypeScript configuration
└── wrangler.toml        # Cloudflare Workers configuration
```

## Changelog

### Version 2.0.0

- Complete project restructuring with improved modularity
- Added compression support with polyfill for `CompressionStream`
- Enhanced error handling middleware
- Updated MongoDB connection with better error feedback
- Improved CORS configuration for better security
- Updated to latest Hono v4.7.4 and Mongoose v8.12.1
- Enhanced TypeScript support and typings
- Standardized export patterns across modules
- Added admin role functionality with middleware protection
- Added profile editing functionality

### Version 1.0.0

- Initial release with basic CRUD functionality
- MongoDB integration
- JWT-based authentication
- Basic error handling

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contact
  https://905local.com/


