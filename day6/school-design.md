Day 6: School Database Design
Tables
- students stores each student's ID, full name, and email address. student_id is the primary key, and email is required and unique so two student records cannot use the same email.
- courses stores each course's ID, name, and optional description. course_id is the primary key, and course_name is required and unique.
- enrolments records which student is taking which course, along with the student's grade for that course. enrolment_id is the primary key. student_id and course_id are foreign keys that reference students and courses. Both foreign-key columns are required. The UNIQUE (student_id, course_id) constraint prevents a student from being enrolled in the same course more than once.
Relationships
A student can have many enrolment records, while each enrolment belongs to one student. This is a one-to-many relationship from students to enrolments.

A course can also have many enrolment records, while each enrolment belongs to one course. This is a one-to-many relationship from courses to enrolments.

Taken together, students and courses have a many-to-many relationship: one student can take multiple courses, and one course can have multiple students. The enrolments table is the join table that resolves this relationship. It stores the two foreign keys and the grade, which is an attribute of a student's enrolment in a particular course rather than of the student or course alone.
Index
I would add an index on enrolments(course_id) to help queries that list students in a course or count enrolments per course. SQLite automatically creates indexes for primary keys and unique constraints, but a separate index on course_id can still be useful because the unique constraint on (student_id, course_id) starts with student_id and is not as suitable for searches by course_id alone.

Example:
SQL
CREATE INDEX idx_enrolments_course_id
ON enrolments(course_id);


SQL or NoSQL?
I would choose a relational SQL database such as SQLite for this school system. The data has clear relationships between students, courses, and enrolments, and it benefits from primary keys, foreign keys, unique constraints, and transactions to keep records consistent. SQL joins also make it straightforward to list courses for a student, list students on a course, and calculate enrolment totals. A NoSQL database can be useful when data has highly variable structures or needs a different scaling model, but that flexibility is not necessary for this small, structured school database. SQLite is especially appropriate for this assignment because it is lightweight and the required SQL can run in SQLite-compatible playgrounds.