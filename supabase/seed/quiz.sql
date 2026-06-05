-- Daily Quiz seed — ~30 World Cup trivia questions, one per UTC date starting
-- 2026-06-06. Idempotent on active_on (unique); re-running is a no-op.
-- Apply with: psql "$DATABASE_URL" -f supabase/seed/quiz.sql  (or supabase db reset locally).

insert into public.quiz_questions (prompt, options, correct_index, active_on) values
  ('Which country won the first FIFA World Cup, in 1930?', array['Uruguay','Brazil','Argentina','Italy'], 0, '2026-06-06'),
  ('How many World Cups has Brazil won?', array['3','4','5','6'], 2, '2026-06-07'),
  ('Which country hosted and won the 1998 World Cup?', array['France','Brazil','Italy','Spain'], 0, '2026-06-08'),
  ('Who won the 2022 World Cup in Qatar?', array['Argentina','France','Croatia','Brazil'], 0, '2026-06-09'),
  ('Who scored the "Hand of God" goal in 1986?', array['Diego Maradona','Pelé','Zico','Michel Platini'], 0, '2026-06-10'),
  ('Which nation has appeared in every World Cup?', array['Brazil','Germany','Italy','Argentina'], 0, '2026-06-11'),
  ('Who is the all-time top scorer in World Cup finals?', array['Miroslav Klose','Ronaldo','Gerd Müller','Pelé'], 0, '2026-06-12'),
  ('Where was the 1966 World Cup held?', array['England','West Germany','Mexico','Chile'], 0, '2026-06-13'),
  ('Which country won the 2010 World Cup?', array['Spain','Netherlands','Germany','Uruguay'], 0, '2026-06-14'),
  ('How many countries are hosting the 2026 World Cup?', array['1','2','3','4'], 2, '2026-06-15'),
  ('How many teams play in the 2026 World Cup?', array['32','40','48','64'], 2, '2026-06-16'),
  ('Which country won the 2014 World Cup?', array['Germany','Argentina','Brazil','Netherlands'], 0, '2026-06-17'),
  ('Who won the Golden Ball at the 2022 World Cup?', array['Lionel Messi','Kylian Mbappé','Luka Modrić','Neymar'], 0, '2026-06-18'),
  ('Who won the Golden Boot at the 2022 World Cup?', array['Kylian Mbappé','Lionel Messi','Olivier Giroud','Julián Álvarez'], 0, '2026-06-19'),
  ('Which country won the 1950 World Cup?', array['Uruguay','Brazil','Italy','Sweden'], 0, '2026-06-20'),
  ('How many times has Italy won the World Cup?', array['2','3','4','5'], 2, '2026-06-21'),
  ('Which African nation first reached a World Cup quarter-final?', array['Cameroon','Senegal','Ghana','Nigeria'], 0, '2026-06-22'),
  ('Who scored a hat-trick in the 1966 World Cup final?', array['Geoff Hurst','Bobby Charlton','Pelé','Eusébio'], 0, '2026-06-23'),
  ('Which country lost the World Cup finals of 1974, 1978 and 2010?', array['Netherlands','Germany','Argentina','Hungary'], 0, '2026-06-24'),
  ('In which year was the current World Cup trophy first awarded?', array['1974','1970','1982','1966'], 0, '2026-06-25'),
  ('Which city hosted the 2014 World Cup final?', array['Rio de Janeiro','São Paulo','Brasília','Belo Horizonte'], 0, '2026-06-26'),
  ('Who is often cited as the youngest player to score in a World Cup?', array['Pelé','Kylian Mbappé','Michael Owen','Diego Maradona'], 0, '2026-06-27'),
  ('How many World Cups has Germany (incl. West Germany) won?', array['2','3','4','5'], 2, '2026-06-28'),
  ('Which goalkeeper captained Spain to the 2010 title?', array['Iker Casillas','Víctor Valdés','Pepe Reina','David de Gea'], 0, '2026-06-29'),
  ('In which final was Zinedine Zidane sent off for a headbutt?', array['2006','1998','2002','2010'], 0, '2026-06-30'),
  ('Who co-hosted the 2002 World Cup with Japan?', array['South Korea','China','Australia','Qatar'], 0, '2026-07-01'),
  ('How long is a standard World Cup match, excluding stoppage time?', array['90 minutes','80 minutes','100 minutes','120 minutes'], 0, '2026-07-02'),
  ('Who won the Golden Boot at the 2018 World Cup?', array['Harry Kane','Kylian Mbappé','Romelu Lukaku','Antoine Griezmann'], 0, '2026-07-03'),
  ('Which country won the 2006 World Cup?', array['Italy','France','Germany','Brazil'], 0, '2026-07-04'),
  ('Which metro area hosts the 2026 World Cup final?', array['New York / New Jersey','Los Angeles','Dallas','Mexico City'], 0, '2026-07-05')
on conflict (active_on) do nothing;
