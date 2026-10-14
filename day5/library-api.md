
# Library Books REST API

## Overview

This API allows clients to manage books in a library.
The resource is `books`, and the API uses JSON for request
and response bodies.

Base URL: `/api/v1`

## Endpoints

### 1. List all books

- **Method:** GET
- **Path:** `/api/v1/books`
- **Description:** Returns a list of all books in the library.
- **Success status:** 200 OK
- **Example request body:** Not required.

### 2. Get a single book

- **Method:** GET
- **Path:** `/api/v1/books/{id}`
- **Description:** Returns the details of a book with the specified ID.
- **Success status:** 200 OK
- **Example request body:** Not required.

Example path: `/api/v1/books/12`

### 3. Create a book

- **Method:** POST
- **Path:** `/api/v1/books`
- **Description:** Adds a new book to the library.
- **Success status:** 201 Created

Example request body:

```json
{
  "title": "JavaScript Fundamentals",
  "author": "Jane Developer",
  "isbn": "9781234567890",
  "publishedYear": 2025
}
```

### 4. Update a book

- **Method:** PUT
- **Path:** `/api/v1/books/{id}`
- **Description:** Replaces the details of an existing book.
- **Success status:** 200 OK

Example request body:

```json
{
  "title": "Advanced JavaScript",
  "author": "Jane Developer",
  "isbn": "9781234567890",
  "publishedYear": 2026
}
```

### 5. Delete a book

- **Method:** DELETE
- **Path:** `/api/v1/books/{id}`
- **Description:** Deletes the specified book from the library.
- **Success status:** 204 No Content
- **Example request body:** Not required.

### 6. List books by author

- **Method:** GET
- **Path:** `/api/v1/books?author={authorName}`
- **Description:** Returns books written by the specified author.
- **Success status:** 200 OK
- **Example request body:** Not required.

Example request:

`GET /api/v1/books?author=Jane%20Developer`

### 7. Search books by title

- **Method:** GET
- **Path:** `/api/v1/books?title={title}`
- **Description:** Returns books whose titles match the search term.
- **Success status:** 200 OK
- **Example request body:** Not required.

## Error Responses

### 400 Bad Request

- **Meaning:** The request contains invalid data.
- **Example:** A client attempts to create a book without a title
  or submits an invalid publication year.
- **Example response:**

```json
{
  "error": "Bad Request",
  "message": "The title field is required."
}
```

### 404 Not Found

- **Meaning:** The requested resource does not exist.
- **Example:** A client requests `/api/v1/books/9999`, but
  no book with ID 9999 exists.
- **Example response:**

```json
{
  "error": "Not Found",
  "message": "The requested book was not found."
}
```

## Notes

- All JSON requests should use the `Content-Type: application/json`
  header when sending a request body.
- Book IDs should uniquely identify each book.
- Query parameters should be URL-encoded when necessary.
- The API should validate submitted data before saving it.
