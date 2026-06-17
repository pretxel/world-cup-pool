// Canonical source of truth for the daily-quiz seed content (English + ES/FR/DE).
// Run `node scripts/gen-quiz-translations.mjs` to regenerate, from this one
// array:
//   - supabase/seed/quiz.sql                                  (fresh installs)
//   - supabase/migrations/20260617000000_quiz_question_translations_de_backfill.sql
//   - tests/fixtures/quiz-translations.ts                     (test fixture)
//
// English stays canonical in the base prompt/options columns; `es`/`fr`/`de`
// carry positionally-aligned translations so the stored correct_index grades
// every locale identically. Option order is NEVER changed across locales.
//
// NOTE: the historical es/fr backfill migration 20260614020000 is already
// applied to remote and is left UNTOUCHED. German is added via a new, dated,
// idempotent backfill migration that rewrites each seeded question's full
// {es, fr, de} translations object (es/fr values are unchanged).

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * @typedef {{ prompt: string, options: string[] }} Localized
 * @typedef {{
 *   activeOn: string,
 *   prompt: string,
 *   options: string[],
 *   correctIndex: number,
 *   es: Localized,
 *   fr: Localized,
 *   de: Localized,
 * }} Question
 */

/** @type {Question[]} */
const QUESTIONS = [
  {
    activeOn: "2026-06-05",
    prompt: "How often is the men's FIFA World Cup held?",
    options: ["Every 4 years", "Every 2 years", "Every 3 years", "Every year"],
    correctIndex: 0,
    es: {
      prompt: "¿Cada cuánto se celebra la Copa Mundial masculina de la FIFA?",
      options: ["Cada 4 años", "Cada 2 años", "Cada 3 años", "Cada año"],
    },
    fr: {
      prompt: "À quelle fréquence a lieu la Coupe du monde masculine de la FIFA ?",
      options: ["Tous les 4 ans", "Tous les 2 ans", "Tous les 3 ans", "Tous les ans"],
    },
    de: {
      prompt: "Wie oft findet die FIFA-Weltmeisterschaft der Männer statt?",
      options: ["Alle 4 Jahre", "Alle 2 Jahre", "Alle 3 Jahre", "Jedes Jahr"],
    },
  },
  {
    activeOn: "2026-06-06",
    prompt: "Which country won the first FIFA World Cup, in 1930?",
    options: ["Uruguay", "Brazil", "Argentina", "Italy"],
    correctIndex: 0,
    es: {
      prompt: "¿Qué país ganó la primera Copa Mundial de la FIFA, en 1930?",
      options: ["Uruguay", "Brasil", "Argentina", "Italia"],
    },
    fr: {
      prompt: "Quel pays a remporté la première Coupe du monde de la FIFA, en 1930 ?",
      options: ["Uruguay", "Brésil", "Argentine", "Italie"],
    },
    de: {
      prompt: "Welches Land gewann die erste FIFA-Weltmeisterschaft 1930?",
      options: ["Uruguay", "Brasilien", "Argentinien", "Italien"],
    },
  },
  {
    activeOn: "2026-06-07",
    prompt: "How many World Cups has Brazil won?",
    options: ["3", "4", "5", "6"],
    correctIndex: 2,
    es: {
      prompt: "¿Cuántas Copas Mundiales ha ganado Brasil?",
      options: ["3", "4", "5", "6"],
    },
    fr: {
      prompt: "Combien de Coupes du monde le Brésil a-t-il remportées ?",
      options: ["3", "4", "5", "6"],
    },
    de: {
      prompt: "Wie viele Weltmeisterschaften hat Brasilien gewonnen?",
      options: ["3", "4", "5", "6"],
    },
  },
  {
    activeOn: "2026-06-08",
    prompt: "Which country hosted and won the 1998 World Cup?",
    options: ["France", "Brazil", "Italy", "Spain"],
    correctIndex: 0,
    es: {
      prompt: "¿Qué país organizó y ganó la Copa Mundial de 1998?",
      options: ["Francia", "Brasil", "Italia", "España"],
    },
    fr: {
      prompt: "Quel pays a organisé et remporté la Coupe du monde 1998 ?",
      options: ["France", "Brésil", "Italie", "Espagne"],
    },
    de: {
      prompt: "Welches Land war Gastgeber und Sieger der Weltmeisterschaft 1998?",
      options: ["Frankreich", "Brasilien", "Italien", "Spanien"],
    },
  },
  {
    activeOn: "2026-06-09",
    prompt: "Who won the 2022 World Cup in Qatar?",
    options: ["Argentina", "France", "Croatia", "Brazil"],
    correctIndex: 0,
    es: {
      prompt: "¿Quién ganó la Copa Mundial de 2022 en Catar?",
      options: ["Argentina", "Francia", "Croacia", "Brasil"],
    },
    fr: {
      prompt: "Qui a remporté la Coupe du monde 2022 au Qatar ?",
      options: ["Argentine", "France", "Croatie", "Brésil"],
    },
    de: {
      prompt: "Wer gewann die Weltmeisterschaft 2022 in Katar?",
      options: ["Argentinien", "Frankreich", "Kroatien", "Brasilien"],
    },
  },
  {
    activeOn: "2026-06-10",
    prompt: 'Who scored the "Hand of God" goal in 1986?',
    options: ["Diego Maradona", "Pelé", "Zico", "Michel Platini"],
    correctIndex: 0,
    es: {
      prompt: "¿Quién marcó el gol de «la Mano de Dios» en 1986?",
      options: ["Diego Maradona", "Pelé", "Zico", "Michel Platini"],
    },
    fr: {
      prompt: "Qui a marqué le but de « la Main de Dieu » en 1986 ?",
      options: ["Diego Maradona", "Pelé", "Zico", "Michel Platini"],
    },
    de: {
      prompt: "Wer erzielte 1986 das Tor mit der „Hand Gottes“?",
      options: ["Diego Maradona", "Pelé", "Zico", "Michel Platini"],
    },
  },
  {
    activeOn: "2026-06-11",
    prompt: "Which nation has appeared in every World Cup?",
    options: ["Brazil", "Germany", "Italy", "Argentina"],
    correctIndex: 0,
    es: {
      prompt: "¿Qué selección ha estado presente en todas las Copas Mundiales?",
      options: ["Brasil", "Alemania", "Italia", "Argentina"],
    },
    fr: {
      prompt: "Quelle nation a participé à toutes les Coupes du monde ?",
      options: ["Brésil", "Allemagne", "Italie", "Argentine"],
    },
    de: {
      prompt: "Welche Nation war bei jeder Weltmeisterschaft dabei?",
      options: ["Brasilien", "Deutschland", "Italien", "Argentinien"],
    },
  },
  {
    activeOn: "2026-06-12",
    prompt: "Who is the all-time top scorer in World Cup finals?",
    options: ["Miroslav Klose", "Ronaldo", "Gerd Müller", "Pelé"],
    correctIndex: 0,
    es: {
      prompt: "¿Quién es el máximo goleador histórico en fases finales de la Copa Mundial?",
      options: ["Miroslav Klose", "Ronaldo", "Gerd Müller", "Pelé"],
    },
    fr: {
      prompt: "Qui est le meilleur buteur de l'histoire en phase finale de Coupe du monde ?",
      options: ["Miroslav Klose", "Ronaldo", "Gerd Müller", "Pelé"],
    },
    de: {
      prompt: "Wer ist der erfolgreichste Torschütze der WM-Endrunden aller Zeiten?",
      options: ["Miroslav Klose", "Ronaldo", "Gerd Müller", "Pelé"],
    },
  },
  {
    activeOn: "2026-06-13",
    prompt: "Where was the 1966 World Cup held?",
    options: ["England", "West Germany", "Mexico", "Chile"],
    correctIndex: 0,
    es: {
      prompt: "¿Dónde se celebró la Copa Mundial de 1966?",
      options: ["Inglaterra", "Alemania Occidental", "México", "Chile"],
    },
    fr: {
      prompt: "Où s'est déroulée la Coupe du monde 1966 ?",
      options: ["Angleterre", "Allemagne de l'Ouest", "Mexique", "Chili"],
    },
    de: {
      prompt: "Wo fand die Weltmeisterschaft 1966 statt?",
      options: ["England", "Westdeutschland", "Mexiko", "Chile"],
    },
  },
  {
    activeOn: "2026-06-14",
    prompt: "Which country won the 2010 World Cup?",
    options: ["Spain", "Netherlands", "Germany", "Uruguay"],
    correctIndex: 0,
    es: {
      prompt: "¿Qué país ganó la Copa Mundial de 2010?",
      options: ["España", "Países Bajos", "Alemania", "Uruguay"],
    },
    fr: {
      prompt: "Quel pays a remporté la Coupe du monde 2010 ?",
      options: ["Espagne", "Pays-Bas", "Allemagne", "Uruguay"],
    },
    de: {
      prompt: "Welches Land gewann die Weltmeisterschaft 2010?",
      options: ["Spanien", "Niederlande", "Deutschland", "Uruguay"],
    },
  },
  {
    activeOn: "2026-06-15",
    prompt: "How many countries are hosting the 2026 World Cup?",
    options: ["1", "2", "3", "4"],
    correctIndex: 2,
    es: {
      prompt: "¿Cuántos países organizan la Copa Mundial de 2026?",
      options: ["1", "2", "3", "4"],
    },
    fr: {
      prompt: "Combien de pays organisent la Coupe du monde 2026 ?",
      options: ["1", "2", "3", "4"],
    },
    de: {
      prompt: "Wie viele Länder richten die Weltmeisterschaft 2026 aus?",
      options: ["1", "2", "3", "4"],
    },
  },
  {
    activeOn: "2026-06-16",
    prompt: "How many teams play in the 2026 World Cup?",
    options: ["32", "40", "48", "64"],
    correctIndex: 2,
    es: {
      prompt: "¿Cuántas selecciones juegan la Copa Mundial de 2026?",
      options: ["32", "40", "48", "64"],
    },
    fr: {
      prompt: "Combien d'équipes jouent la Coupe du monde 2026 ?",
      options: ["32", "40", "48", "64"],
    },
    de: {
      prompt: "Wie viele Mannschaften spielen bei der Weltmeisterschaft 2026?",
      options: ["32", "40", "48", "64"],
    },
  },
  {
    activeOn: "2026-06-17",
    prompt: "Which country won the 2014 World Cup?",
    options: ["Germany", "Argentina", "Brazil", "Netherlands"],
    correctIndex: 0,
    es: {
      prompt: "¿Qué país ganó la Copa Mundial de 2014?",
      options: ["Alemania", "Argentina", "Brasil", "Países Bajos"],
    },
    fr: {
      prompt: "Quel pays a remporté la Coupe du monde 2014 ?",
      options: ["Allemagne", "Argentine", "Brésil", "Pays-Bas"],
    },
    de: {
      prompt: "Welches Land gewann die Weltmeisterschaft 2014?",
      options: ["Deutschland", "Argentinien", "Brasilien", "Niederlande"],
    },
  },
  {
    activeOn: "2026-06-18",
    prompt: "Who won the Golden Ball at the 2022 World Cup?",
    options: ["Lionel Messi", "Kylian Mbappé", "Luka Modrić", "Neymar"],
    correctIndex: 0,
    es: {
      prompt: "¿Quién ganó el Balón de Oro en la Copa Mundial de 2022?",
      options: ["Lionel Messi", "Kylian Mbappé", "Luka Modrić", "Neymar"],
    },
    fr: {
      prompt: "Qui a remporté le Ballon d'or de la Coupe du monde 2022 ?",
      options: ["Lionel Messi", "Kylian Mbappé", "Luka Modrić", "Neymar"],
    },
    de: {
      prompt: "Wer gewann den Goldenen Ball bei der Weltmeisterschaft 2022?",
      options: ["Lionel Messi", "Kylian Mbappé", "Luka Modrić", "Neymar"],
    },
  },
  {
    activeOn: "2026-06-19",
    prompt: "Who won the Golden Boot at the 2022 World Cup?",
    options: ["Kylian Mbappé", "Lionel Messi", "Olivier Giroud", "Julián Álvarez"],
    correctIndex: 0,
    es: {
      prompt: "¿Quién ganó la Bota de Oro en la Copa Mundial de 2022?",
      options: ["Kylian Mbappé", "Lionel Messi", "Olivier Giroud", "Julián Álvarez"],
    },
    fr: {
      prompt: "Qui a remporté le Soulier d'or de la Coupe du monde 2022 ?",
      options: ["Kylian Mbappé", "Lionel Messi", "Olivier Giroud", "Julián Álvarez"],
    },
    de: {
      prompt: "Wer gewann den Goldenen Schuh bei der Weltmeisterschaft 2022?",
      options: ["Kylian Mbappé", "Lionel Messi", "Olivier Giroud", "Julián Álvarez"],
    },
  },
  {
    activeOn: "2026-06-20",
    prompt: "Which country won the 1950 World Cup?",
    options: ["Uruguay", "Brazil", "Italy", "Sweden"],
    correctIndex: 0,
    es: {
      prompt: "¿Qué país ganó la Copa Mundial de 1950?",
      options: ["Uruguay", "Brasil", "Italia", "Suecia"],
    },
    fr: {
      prompt: "Quel pays a remporté la Coupe du monde 1950 ?",
      options: ["Uruguay", "Brésil", "Italie", "Suède"],
    },
    de: {
      prompt: "Welches Land gewann die Weltmeisterschaft 1950?",
      options: ["Uruguay", "Brasilien", "Italien", "Schweden"],
    },
  },
  {
    activeOn: "2026-06-21",
    prompt: "How many times has Italy won the World Cup?",
    options: ["2", "3", "4", "5"],
    correctIndex: 2,
    es: {
      prompt: "¿Cuántas veces ha ganado Italia la Copa Mundial?",
      options: ["2", "3", "4", "5"],
    },
    fr: {
      prompt: "Combien de fois l'Italie a-t-elle remporté la Coupe du monde ?",
      options: ["2", "3", "4", "5"],
    },
    de: {
      prompt: "Wie oft hat Italien die Weltmeisterschaft gewonnen?",
      options: ["2", "3", "4", "5"],
    },
  },
  {
    activeOn: "2026-06-22",
    prompt: "Which African nation first reached a World Cup quarter-final?",
    options: ["Cameroon", "Senegal", "Ghana", "Nigeria"],
    correctIndex: 0,
    es: {
      prompt: "¿Qué selección africana llegó por primera vez a unos cuartos de final de la Copa Mundial?",
      options: ["Camerún", "Senegal", "Ghana", "Nigeria"],
    },
    fr: {
      prompt: "Quelle nation africaine a été la première à atteindre un quart de finale de Coupe du monde ?",
      options: ["Cameroun", "Sénégal", "Ghana", "Nigeria"],
    },
    de: {
      prompt: "Welche afrikanische Nation erreichte als erste ein WM-Viertelfinale?",
      options: ["Kamerun", "Senegal", "Ghana", "Nigeria"],
    },
  },
  {
    activeOn: "2026-06-23",
    prompt: "Who scored a hat-trick in the 1966 World Cup final?",
    options: ["Geoff Hurst", "Bobby Charlton", "Pelé", "Eusébio"],
    correctIndex: 0,
    es: {
      prompt: "¿Quién marcó un triplete en la final de la Copa Mundial de 1966?",
      options: ["Geoff Hurst", "Bobby Charlton", "Pelé", "Eusébio"],
    },
    fr: {
      prompt: "Qui a inscrit un triplé en finale de la Coupe du monde 1966 ?",
      options: ["Geoff Hurst", "Bobby Charlton", "Pelé", "Eusébio"],
    },
    de: {
      prompt: "Wer erzielte im WM-Finale 1966 einen Hattrick?",
      options: ["Geoff Hurst", "Bobby Charlton", "Pelé", "Eusébio"],
    },
  },
  {
    activeOn: "2026-06-24",
    prompt: "Which country lost the World Cup finals of 1974, 1978 and 2010?",
    options: ["Netherlands", "Germany", "Argentina", "Hungary"],
    correctIndex: 0,
    es: {
      prompt: "¿Qué país perdió las finales de la Copa Mundial de 1974, 1978 y 2010?",
      options: ["Países Bajos", "Alemania", "Argentina", "Hungría"],
    },
    fr: {
      prompt: "Quel pays a perdu les finales de la Coupe du monde de 1974, 1978 et 2010 ?",
      options: ["Pays-Bas", "Allemagne", "Argentine", "Hongrie"],
    },
    de: {
      prompt: "Welches Land verlor die WM-Finals von 1974, 1978 und 2010?",
      options: ["Niederlande", "Deutschland", "Argentinien", "Ungarn"],
    },
  },
  {
    activeOn: "2026-06-25",
    prompt: "In which year was the current World Cup trophy first awarded?",
    options: ["1974", "1970", "1982", "1966"],
    correctIndex: 0,
    es: {
      prompt: "¿En qué año se entregó por primera vez el trofeo actual de la Copa Mundial?",
      options: ["1974", "1970", "1982", "1966"],
    },
    fr: {
      prompt: "En quelle année le trophée actuel de la Coupe du monde a-t-il été décerné pour la première fois ?",
      options: ["1974", "1970", "1982", "1966"],
    },
    de: {
      prompt: "In welchem Jahr wurde die aktuelle WM-Trophäe erstmals vergeben?",
      options: ["1974", "1970", "1982", "1966"],
    },
  },
  {
    activeOn: "2026-06-26",
    prompt: "Which city hosted the 2014 World Cup final?",
    options: ["Rio de Janeiro", "São Paulo", "Brasília", "Belo Horizonte"],
    correctIndex: 0,
    es: {
      prompt: "¿Qué ciudad acogió la final de la Copa Mundial de 2014?",
      options: ["Río de Janeiro", "São Paulo", "Brasilia", "Belo Horizonte"],
    },
    fr: {
      prompt: "Quelle ville a accueilli la finale de la Coupe du monde 2014 ?",
      options: ["Rio de Janeiro", "São Paulo", "Brasilia", "Belo Horizonte"],
    },
    de: {
      prompt: "Welche Stadt war Austragungsort des WM-Finals 2014?",
      options: ["Rio de Janeiro", "São Paulo", "Brasília", "Belo Horizonte"],
    },
  },
  {
    activeOn: "2026-06-27",
    prompt: "Who is often cited as the youngest player to score in a World Cup?",
    options: ["Pelé", "Kylian Mbappé", "Michael Owen", "Diego Maradona"],
    correctIndex: 0,
    es: {
      prompt: "¿A quién se cita a menudo como el jugador más joven en marcar en una Copa Mundial?",
      options: ["Pelé", "Kylian Mbappé", "Michael Owen", "Diego Maradona"],
    },
    fr: {
      prompt: "Qui est souvent cité comme le plus jeune joueur à marquer en Coupe du monde ?",
      options: ["Pelé", "Kylian Mbappé", "Michael Owen", "Diego Maradona"],
    },
    de: {
      prompt: "Wer gilt oft als jüngster Spieler, der bei einer Weltmeisterschaft traf?",
      options: ["Pelé", "Kylian Mbappé", "Michael Owen", "Diego Maradona"],
    },
  },
  {
    activeOn: "2026-06-28",
    prompt: "How many World Cups has Germany (incl. West Germany) won?",
    options: ["2", "3", "4", "5"],
    correctIndex: 2,
    es: {
      prompt: "¿Cuántas Copas Mundiales ha ganado Alemania (incl. Alemania Occidental)?",
      options: ["2", "3", "4", "5"],
    },
    fr: {
      prompt: "Combien de Coupes du monde l'Allemagne (RFA comprise) a-t-elle remportées ?",
      options: ["2", "3", "4", "5"],
    },
    de: {
      prompt: "Wie viele Weltmeisterschaften hat Deutschland (inkl. Westdeutschland) gewonnen?",
      options: ["2", "3", "4", "5"],
    },
  },
  {
    activeOn: "2026-06-29",
    prompt: "Which goalkeeper captained Spain to the 2010 title?",
    options: ["Iker Casillas", "Víctor Valdés", "Pepe Reina", "David de Gea"],
    correctIndex: 0,
    es: {
      prompt: "¿Qué portero fue capitán de España en el título de 2010?",
      options: ["Iker Casillas", "Víctor Valdés", "Pepe Reina", "David de Gea"],
    },
    fr: {
      prompt: "Quel gardien était le capitaine de l'Espagne lors du titre de 2010 ?",
      options: ["Iker Casillas", "Víctor Valdés", "Pepe Reina", "David de Gea"],
    },
    de: {
      prompt: "Welcher Torhüter führte Spanien als Kapitän zum Titel 2010?",
      options: ["Iker Casillas", "Víctor Valdés", "Pepe Reina", "David de Gea"],
    },
  },
  {
    activeOn: "2026-06-30",
    prompt: "In which final was Zinedine Zidane sent off for a headbutt?",
    options: ["2006", "1998", "2002", "2010"],
    correctIndex: 0,
    es: {
      prompt: "¿En qué final fue expulsado Zinedine Zidane por un cabezazo?",
      options: ["2006", "1998", "2002", "2010"],
    },
    fr: {
      prompt: "Lors de quelle finale Zinedine Zidane a-t-il été expulsé pour un coup de tête ?",
      options: ["2006", "1998", "2002", "2010"],
    },
    de: {
      prompt: "In welchem Finale wurde Zinedine Zidane wegen eines Kopfstoßes vom Platz gestellt?",
      options: ["2006", "1998", "2002", "2010"],
    },
  },
  {
    activeOn: "2026-07-01",
    prompt: "Who co-hosted the 2002 World Cup with Japan?",
    options: ["South Korea", "China", "Australia", "Qatar"],
    correctIndex: 0,
    es: {
      prompt: "¿Quién fue coanfitrión de la Copa Mundial de 2002 junto a Japón?",
      options: ["Corea del Sur", "China", "Australia", "Catar"],
    },
    fr: {
      prompt: "Qui a coorganisé la Coupe du monde 2002 avec le Japon ?",
      options: ["Corée du Sud", "Chine", "Australie", "Qatar"],
    },
    de: {
      prompt: "Wer war neben Japan Co-Gastgeber der Weltmeisterschaft 2002?",
      options: ["Südkorea", "China", "Australien", "Katar"],
    },
  },
  {
    activeOn: "2026-07-02",
    prompt: "How long is a standard World Cup match, excluding stoppage time?",
    options: ["90 minutes", "80 minutes", "100 minutes", "120 minutes"],
    correctIndex: 0,
    es: {
      prompt: "¿Cuánto dura un partido estándar de la Copa Mundial, sin contar el tiempo añadido?",
      options: ["90 minutos", "80 minutos", "100 minutos", "120 minutos"],
    },
    fr: {
      prompt: "Combien de temps dure un match standard de Coupe du monde, hors temps additionnel ?",
      options: ["90 minutes", "80 minutes", "100 minutes", "120 minutes"],
    },
    de: {
      prompt: "Wie lange dauert ein reguläres WM-Spiel ohne Nachspielzeit?",
      options: ["90 Minuten", "80 Minuten", "100 Minuten", "120 Minuten"],
    },
  },
  {
    activeOn: "2026-07-03",
    prompt: "Who won the Golden Boot at the 2018 World Cup?",
    options: ["Harry Kane", "Kylian Mbappé", "Romelu Lukaku", "Antoine Griezmann"],
    correctIndex: 0,
    es: {
      prompt: "¿Quién ganó la Bota de Oro en la Copa Mundial de 2018?",
      options: ["Harry Kane", "Kylian Mbappé", "Romelu Lukaku", "Antoine Griezmann"],
    },
    fr: {
      prompt: "Qui a remporté le Soulier d'or de la Coupe du monde 2018 ?",
      options: ["Harry Kane", "Kylian Mbappé", "Romelu Lukaku", "Antoine Griezmann"],
    },
    de: {
      prompt: "Wer gewann den Goldenen Schuh bei der Weltmeisterschaft 2018?",
      options: ["Harry Kane", "Kylian Mbappé", "Romelu Lukaku", "Antoine Griezmann"],
    },
  },
  {
    activeOn: "2026-07-04",
    prompt: "Which country won the 2006 World Cup?",
    options: ["Italy", "France", "Germany", "Brazil"],
    correctIndex: 0,
    es: {
      prompt: "¿Qué país ganó la Copa Mundial de 2006?",
      options: ["Italia", "Francia", "Alemania", "Brasil"],
    },
    fr: {
      prompt: "Quel pays a remporté la Coupe du monde 2006 ?",
      options: ["Italie", "France", "Allemagne", "Brésil"],
    },
    de: {
      prompt: "Welches Land gewann die Weltmeisterschaft 2006?",
      options: ["Italien", "Frankreich", "Deutschland", "Brasilien"],
    },
  },
  {
    activeOn: "2026-07-05",
    prompt: "Which metro area hosts the 2026 World Cup final?",
    options: ["New York / New Jersey", "Los Angeles", "Dallas", "Mexico City"],
    correctIndex: 0,
    es: {
      prompt: "¿Qué área metropolitana acoge la final de la Copa Mundial de 2026?",
      options: ["Nueva York / Nueva Jersey", "Los Ángeles", "Dallas", "Ciudad de México"],
    },
    fr: {
      prompt: "Quelle agglomération accueille la finale de la Coupe du monde 2026 ?",
      options: ["New York / New Jersey", "Los Angeles", "Dallas", "Mexico"],
    },
    de: {
      prompt: "Welche Metropolregion ist Austragungsort des WM-Finals 2026?",
      options: ["New York / New Jersey", "Los Angeles", "Dallas", "Mexiko-Stadt"],
    },
  },
];

// --- helpers ---------------------------------------------------------------

/** Double single quotes for a Postgres single-quoted string literal. */
const sqlStr = (s) => `'${String(s).replaceAll("'", "''")}'`;

/** `array['a','b',...]` literal. */
const sqlArray = (arr) => `array[${arr.map(sqlStr).join(",")}]`;

/** Build the translations object in a FIXED key order (es, fr, de). */
const translationsObject = (q) => ({
  es: { prompt: q.es.prompt, options: q.es.options },
  fr: { prompt: q.fr.prompt, options: q.fr.options },
  de: { prompt: q.de.prompt, options: q.de.options },
});

/** `'{"es":...}'::jsonb` literal — same string the test recomputes. */
const sqlJsonb = (q) => `${sqlStr(JSON.stringify(translationsObject(q)))}::jsonb`;

// --- emit seed -------------------------------------------------------------

const seedHeader = `-- Daily Quiz seed — ~30 World Cup trivia questions, one per UTC date starting
-- 2026-06-06. Idempotent on active_on (unique); re-running is a no-op.
-- Apply with: psql "$DATABASE_URL" -f supabase/seed/quiz.sql  (or supabase db reset locally).
--
-- The translations column carries positionally-aligned es/fr/de translations of
-- the prompt + options. English (the base prompt/options columns) is canonical;
-- correct_index grades every locale the same because option order is identical.
-- GENERATED from scripts/gen-quiz-translations.mjs — edit there, then re-run.

insert into public.quiz_questions (prompt, options, correct_index, active_on, translations) values
`;

const seedRows = QUESTIONS.map(
  (q) =>
    `  (${sqlStr(q.prompt)}, ${sqlArray(q.options)}, ${q.correctIndex}, ${sqlStr(q.activeOn)}, ${sqlJsonb(q)})`,
).join(",\n");

const seedSql = `${seedHeader}${seedRows}\non conflict (active_on) do nothing;\n`;

// --- emit German backfill migration ----------------------------------------

// The historical es/fr backfill (20260614020000) is already applied to remote
// and is intentionally NOT regenerated here. This newer, dated migration adds
// German by rewriting each seeded question's full {es, fr, de} translations
// object keyed on its stable active_on. es/fr values are byte-identical to what
// is already stored, so only `de` is effectively added.
const migrationFilename =
  "20260617000000_quiz_question_translations_de_backfill.sql";

const migrationHeader = `-- ===========================================================================
-- Daily Quiz — backfill GERMAN (de) translations onto already-seeded questions.
-- The historical migration 20260614020000 set es/fr; it is already applied and
-- left untouched. The seed (supabase/seed/quiz.sql) now ships es/fr/de for fresh
-- installs, but it is "on conflict (active_on) do nothing", so databases seeded
-- earlier keep their es/fr-only translations. This sets each seeded question's
-- full {es, fr, de} object by its stable active_on key. Idempotent: re-running
-- writes identical JSON; es/fr are unchanged and only de is added. Only the
-- seeded active_on dates are touched (admin-authored rows untouched).
-- GENERATED from scripts/gen-quiz-translations.mjs — edit there, then re-run.
-- ===========================================================================

`;

const migrationRows = QUESTIONS.map(
  (q) =>
    `update public.quiz_questions set translations = ${sqlJsonb(q)} where active_on = ${sqlStr(q.activeOn)};`,
).join("\n");

const migrationSql = `${migrationHeader}${migrationRows}\n`;

// --- emit TS fixture (test source of truth) --------------------------------

const fixtureTs = `// AUTO-GENERATED by scripts/gen-quiz-translations.mjs — do not edit by hand.
// Canonical daily-quiz seed content (English base + es/fr/de translations), used
// by tests to assert translation completeness and to drift-check the SQL files.

export type QuizSeedLocalized = { prompt: string; options: string[] };

export type QuizSeedQuestion = {
  activeOn: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  es: QuizSeedLocalized;
  fr: QuizSeedLocalized;
  de: QuizSeedLocalized;
};

export const QUIZ_QUESTIONS: QuizSeedQuestion[] = ${JSON.stringify(QUESTIONS, null, 2)};

/** Translations object in the same fixed key order the SQL files embed. */
export function quizTranslations(q: QuizSeedQuestion) {
  return {
    es: { prompt: q.es.prompt, options: q.es.options },
    fr: { prompt: q.fr.prompt, options: q.fr.options },
    de: { prompt: q.de.prompt, options: q.de.options },
  };
}

/** The exact \`'{...}'::jsonb\` body (sans cast) embedded in seed + migration. */
export function quizTranslationsSqlLiteral(q: QuizSeedQuestion): string {
  return JSON.stringify(quizTranslations(q)).replaceAll("'", "''");
}
`;

// --- write -----------------------------------------------------------------

writeFileSync(join(ROOT, "supabase/seed/quiz.sql"), seedSql);
writeFileSync(
  join(ROOT, `supabase/migrations/${migrationFilename}`),
  migrationSql,
);
writeFileSync(join(ROOT, "tests/fixtures/quiz-translations.ts"), fixtureTs);

console.log(`Generated ${QUESTIONS.length} questions →`);
console.log("  supabase/seed/quiz.sql");
console.log(`  supabase/migrations/${migrationFilename}`);
console.log("  tests/fixtures/quiz-translations.ts");
