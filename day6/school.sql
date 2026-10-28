-- Day 6 Assignment: A School Database
-- Database: SQLite
-- Run this file from top to bottom in DB Browser for SQLite or SQLiteOnline.

PRAGMA foreign_keys = ON;

-- Drop tables first so this script can be re-run without table conflicts.
DROP TABLE IF EXISTS enrolments;
DROP TABLE IF EXISTS courses;
DROP TABLE IF EXISTS students;

-- 1. Students: each student has a unique email address.
CREATE TABLE students (
    student_id INTEGER PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE
);

-- 2. Courses: each course has a unique course name.
CREATE TABLE courses (
    course_id INTEGER PRIMARY KEY,
    course_name TEXT NOT NULL UNIQUE,
    description TEXT
);

-- 3. Enrolments: join table connecting students and courses.
-- A student can enrol in many courses, and a course can have many students.
-- The UNIQUE constraint prevents duplicate enrolment in the same course.
CREATE TABLE enrolments (
    enrolment_id INTEGER PRIMARY KEY,
    student_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    grade TEXT,
    FOREIGN KEY (student_id) REFERENCES students(student_id),
    FOREIGN KEY (course_id) REFERENCES courses(course_id),
    UNIQUE (student_id, course_id)
);

-- Sample data: at least 3 students.
INSERT INTO students (student_id, full_name, email) VALUES
    (1, 'Amina Otieno', 'amina.otieno@example.com'),
    (2, 'Brian Mwangi', 'brian.mwangi@example.com'),
    (3, 'Cynthia Wanjiku', 'cynthia.wanjiku@example.com'),
    (4, 'David Kiptoo', 'david.kiptoo@example.com');

-- Sample data: at least 3 courses.
INSERT INTO courses (course_id, course_name, description) VALUES
    (1, 'Database Systems', 'Introduction to relational databases and SQL'),
    (2, 'Web Development', 'HTML, CSS, JavaScript and web application basics'),
    (3, 'Python Programming', 'Programming fundamentals using Python');

-- Sample data: at least 5 enrolments.
INSERT INTO enrolments (enrolment_id, student_id, course_id, grade) VALUES
    (1, 1, 1, 'A'),
    (2, 1, 2, 'B'),
    (3, 2, 1, 'B'),
    (4, 2, 3, 'A'),
    (5, 3, 2, 'A'),
    (6, 3, 3, 'B');

-- QUERY 1: All courses taken by one student, selected by name.
-- Change 'Amina Otieno' to another full_name to look up a different student.
SELECT s.full_name, c.course_name, e.grade
FROM students AS s
JOIN enrolments AS e ON e.student_id = s.student_id
JOIN courses AS c ON c.course_id = e.course_id
WHERE s.full_name = 'Amina Otieno'
ORDER BY c.course_name;

-- QUERY 2: All students enrolled in one course.
-- Change 'Database Systems' to another course name if needed.
SELECT c.course_name, s.full_name, s.email, e.grade
FROM courses AS c
JOIN enrolments AS e ON e.course_id = c.course_id
JOIN students AS s ON s.student_id = e.student_id
WHERE c.course_name = 'Database Systems'
ORDER BY s.full_name;

-- QUERY 3: Number of students enrolled in each course, including courses with zero students.
SELECT c.course_name, COUNT(e.student_id) AS number_of_students
FROM courses AS c
LEFT JOIN enrolments AS e ON e.course_id = c.course_id
GROUP BY c.course_id, c.course_name
ORDER BY c.course_name;

-- QUERY 4: Students who have no enrolments.
SELECT s.student_id, s.full_name, s.email
FROM students AS s
LEFT JOIN enrolments AS e ON e.student_id = s.student_id
WHERE e.enrolment_id IS NULL
ORDER BY s.full_name;

-- QUERY 5: Update the grade for one enrolment, then show the updated row.
UPDATE enrolments
SET grade = 'A'
WHERE student_id = 2 AND course_id = 1;

SELECT s.full_name, c.course_name, e.grade
FROM enrolments AS e
JOIN students AS s ON s.student_id = e.student_id
JOIN courses AS c ON c.course_id = e.course_id
WHERE e.student_id = 2 AND e.course_id = 1;
