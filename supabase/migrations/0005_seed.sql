-- seed.sql: sample catalogue (safe to run once on a fresh database)
insert into public.courses (title, description, price_paise) values
  ('Full Stack Web Development', 'Learn frontend, backend, databases, and deployment.', 499900),
  ('Python Programming', 'Learn Python programming from fundamentals to advanced concepts.', 299900),
  ('Data Structures and Algorithms', 'Master essential data structures and algorithms.', 399900);

insert into public.course_lessons (course_id, title, body, position)
select c.id, 'Lesson ' || n, 'Sample lesson content for ' || c.title, n
from public.courses c, generate_series(1, 2) n;