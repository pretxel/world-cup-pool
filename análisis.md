# Análisis de Engagement — World Cup Pools

> **Nota de método.** Este análisis se basa exclusivamente en el código actual del repositorio. Cada afirmación factual sobre la plataforma está anclada a subsistemas y archivos reales; lo que no existe en el código (push, racha de predicciones, referidos, eventos GA personalizados, preferencias de email in-app, leaderboard en tiempo real/segmentado) se presenta explícitamente como **oportunidad**, no como feature actual. Las dos dependencias bloqueantes —`EMAIL_FROM` con fallback a remitente sandbox y la ausencia total de eventos de analítica personalizados— se verificaron directamente en el código y deben resolverse antes de invertir en el resto, porque condicionan la entrega y la medición de todo lo demás.

---

## 1. Resumen ejecutivo

- **El producto ya tiene loops sólidos de hábito** (predicciones con scoring, quiz diario con racha, leaderboard, recaps con IA), pero **el motor de nudges depende casi exclusivamente del email batch diario en horario UTC fijo (cron a 00:00 UTC)**: no hay notificaciones push, ni avisos in-app al cargar la página, ni segmentación por zona horaria. El recordatorio llega desacoplado del momento de uso real.
- **Hay un bug de configuración que sabotea el motor de retención por email** (verificado): `emailFrom` cae al remitente sandbox `World Cup Pools <onboarding@resend.dev>` cuando `EMAIL_FROM` no está seteado (`lib/env.ts:46`). En producción esto degrada la entregabilidad y la confianza de marca. **Es el quick win nº1.** (Además, `RESEND_API_KEY` sin setear hace no-op silencioso de todo el envío en dev/staging.)
- **La medición de la viralidad está rota**: hay botones de compartir y tarjetas OG en todo el producto, pero **GA solo carga el page view base — cero eventos personalizados** (verificado: no existe ningún `gtag('event', ...)` en `app/` ni `components/`; en `app/layout.tsx:165-179` solo hay `gtag('js')` y `gtag('config')`). No sabemos qué se comparte, qué convierte ni qué emails funcionan.
- **Faltan mecánicas de progresión transversales**: la racha existe solo en el quiz (`computeStreak` en `lib/quiz.ts:72`), no en predicciones ni en grupos; no hay logros, ni bonus por streak de aciertos, ni delta de rank ("subiste 3 puestos"). El leaderboard global es SSR estático y limitado a top 10 (`topRows = rows.slice(0, 10)` en `leaderboard/page.tsx:61`).
- **Los grupos de amigos —la mayor palanca viral— están infraequipados**: sin invitación por email, sin notificación de "fulano se unió", sin emails de grupo, sin recompensa por referido ni tracking de inviter. El loop social se corta en el copiar-pegar del código (`groups/[id]/group-controls.tsx`, solo portapapeles).

---

## 2. Mapa de los loops de engagement actuales

### Lo que YA engancha (loops funcionales)

| Loop | Mecánica | Hook de retorno | Dónde vive |
|---|---|---|---|
| **Predicción → resultado → puntos** | Form con +/-, rango 0-20, lock al kickoff, scoring 5/3/1/0 | Email recordatorio diario + result email post-partido | `prediction-form.tsx`, `lib/scoring.ts`, `lib/notifications/prediction-reminder-emails.ts`, `result-emails.ts` |
| **Quiz diario con racha** | 1 pregunta/día, +10 pts por acierto, contador de racha con llama | Racha visible (in-app, email, OG card) → miedo a romperla | `lib/quiz.ts` (`computeStreak`), `app/api/og/quiz` |
| **Leaderboard competitivo** | Ranking global por puntos, fila propia resaltada | Result email enlaza a `/leaderboard` tras cada partido | `v_leaderboard_overall`, `components/leaderboard-table.tsx` |
| **Recaps IA + galería home** | Recap dramático + cómic 4 viñetas auto-generado por partido final | Feed visual fresco de 5 recaps en home | `lib/match-summary.ts`, `lib/match-image-render.ts`, `components/recent-recap-images.tsx` |
| **Compartir (OG cards)** | Tarjetas X/Facebook/native/copy de pick, rank, quiz | Preview visual aumenta CTR social | `components/share-buttons.tsx`, `app/api/og/{pick,rank,quiz}` |
| **Live polling** | Eventos en vivo cada 15s en match detail; countdown del torneo cada 30s en home | Tirón de regreso durante partidos en directo | `useLivePolling`, `/api/matches/{id}/live`, `tournament-countdown.tsx` |
| **Grupos privados (mini-board)** | Crear/unirse por join code, leaderboard scoped a miembros | Presión competitiva entre amigos + aviso "aún sin ranking" | `lib/groups.ts`, `groups/[id]/page.tsx`, `leaderboard_for_group()` |
| **Feed de noticias** | Feed SSR (12 iniciales) + infinite scroll, sync diario desde NewsAPI | Cadencia de contenido fresco (no surfaceada al usuario) | `news/page.tsx`, `news-feed.tsx`, `lib/news.ts` |

### Lo que NO engancha (loops rotos o ausentes)

- **Email batch UTC fijo** — un único disparo diario para todos. Quien duerme o vive en otra zona horaria se pierde la ventana. No hay push ni toast in-app (`prediction-reminder-emails.ts`, cron `quiz-reminders/route.ts`).
- **Leaderboard estático y truncado** — SSR sin tiempo real, solo top 10 (`slice(0, 10)`), sin búsqueda, sin delta de posición, sin vista semanal/por etapa.
- **Racha confinada al quiz** — no hay racha de predicciones diarias ni de aciertos exactos. El scoring por partido (0-5) no premia constancia.
- **Grupos sin pulso** — sin feed de actividad, sin notificación de alta, sin emails de grupo, sin recompensa por referido. Tablero estático. Además, el scoring es de todo el torneo: los que entran tarde arrastran desventaja sin filtrado por fecha de ingreso.
- **Compartir sin loop de retorno** — `share/pick` es solo lectura; el clic no lleva a registro ni a unirse a un grupo. La viralidad no cierra el círculo. Las páginas de share están en `noindex`, lo que bloquea crecimiento orgánico por SEO.
- **News y standings/bracket = consumo pasivo** — News son enlaces externos que sacan de la app, sin estado leído/guardado; standings/bracket son SSR estáticos sin avisos de cambio.
- **Recap = solo post-partido** — share buttons ocultos hasta que el render Leonardo termina; cero hype pre-partido y dead-end si el render está pendiente.

---

## 3. Fricciones clave que limitan usuarios activos (priorizadas)

> Priorizadas por daño al DAU/retención. Cita de archivo donde aplica.

1. **`EMAIL_FROM` sin configurar en prod → remitente sandbox.** `lib/env.ts:46` usa `World Cup Pools <onboarding@resend.dev>` por defecto. Degrada entregabilidad y marca; el motor de retención por email puede acabar en spam. (Y `RESEND_API_KEY` sin setear no-opea todos los envíos en dev/staging, impidiendo probar los flujos.) **Crítico.**
2. **Cero notificaciones push / in-app.** Solo existe email batch diario en UTC (`prediction-reminder-emails.ts`, cron `quiz-reminders/route.ts`). No hay toast al cargar `/matches`, ni aviso de "pick antes del lock". El nudge no coincide con el momento de uso.
3. **Sin segmentación por zona horaria ni actividad.** Todos reciben el mismo email al mismo instante UTC; usuarios en América despiertan horas después del disparo. Sin supresión a inactivos (fatiga) ni copy personalizado.
4. **Analítica ciega: GA solo carga page view base.** Verificado: ningún `gtag('event', ...)` en `app/`/`components/` (config en `app/layout.tsx:165-179`). No se miden shares, predicciones, respuestas de quiz, joins ni el funnel share→sign-in→primer pick.
5. **Lock duro al kickoff sin gracia ni aviso visual.** `prediction-form.tsx` y `actions.ts` deshabilitan al llegar el kickoff; el countdown se muestra en UTC y puede desincronizar con el reloj cliente. Sin badge "se cierra en 5 min".
6. **Loop viral incompleto en grupos.** Sin invitación por email, sin notificación de alta, sin recompensa por referido, sin tracking de inviter. El código solo soporta copiar al portapapeles (`groups/[id]/group-controls.tsx`). Mata el coeficiente viral.
7. **Leaderboard estático/top-10/global.** SSR sin realtime, `slice(0, 10)` (`leaderboard/page.tsx:61`), sin búsqueda, sin delta de rank, sin vistas semanal/por etapa. Los jugadores de mitad de tabla no tienen competición "alcanzable".
8. **Racha frágil y aislada.** En quiz, un día perdido la rompe sin gracia (`computeStreak`); no existe racha en predicciones. Sin "streak freeze" ni catch-up.
9. **Onboarding de 3 saltos hasta el primer pick.** sign-in → `/onboarding` (display name obligatorio, 2–32 chars) → navegar a un partido → enviar. Cada salto es un punto de abandono; los errores de onboarding se lanzan crudos sin feedback inline (`onboarding/actions.ts:13` arroja `Error("Display name must be 2–32 characters.")`).
10. **Sin UI de preferencias de email.** Opt-out solo vía link en el footer (con header RFC 8058); no hay toggle in-app por tipo (`quiz_reminder_opt_out` / `prediction_reminder_opt_out` existen en `profiles` pero sin UI). El unsubscribe es dead-end permanente y silencioso, sin re-opt-in.
11. **Recaps y shares sin medición ni hype.** Share buttons ocultos hasta que el render acaba; sin contador de shares; texto de compartir genérico. News saca de la app sin estado leído/guardado.
12. **Filtro "Needs Pick" falla en silencio.** Si todo está bloqueado, muestra estado vacío sin mensaje claro de "vuelve mañana" (`needs-pick-toggle.tsx`), suprimiendo el re-engagement.

---

## 4. Palancas para subir usuarios activos (DAU/retención)

### Quick wins (alto impacto / bajo esfuerzo) — empezar aquí

| # | Palanca | Por qué sube usuarios activos | Esfuerzo | Impacto | Archivos |
|---|---|---|---|---|---|
| QW1 | **Configurar `EMAIL_FROM` (y `RESEND_API_KEY`) en prod con dominio verificado** | Desbloquea TODO el motor de retención por email; sin esto, recordatorios y result emails no llegan/van a spam | Bajo | Alto | `lib/env.ts:46`, env de Vercel |
| QW2 | **Toast/banner in-app de picks pendientes al cargar `/matches`** | Captura el nudge en el momento de mayor engagement, sin depender del email UTC | Bajo | Alto | `app/[locale]/(public)/matches`, `needs-pick-toggle.tsx` |
| QW3 | **Eventos GA (share, predicción, quiz answer, group join, leaderboard view)** | Sin esto no se puede optimizar nada; habilita medir el funnel viral y de retención | Bajo | Alto | `app/layout.tsx`, `share-buttons.tsx`, `prediction-form.tsx` |
| QW4 | **CTA "Comparte tu pick" inmediatamente tras enviar** | Convierte el momento de máxima emoción en alcance orgánico → nuevos sign-ins | Bajo | Alto/Med | `prediction-form.tsx`, `share/pick/[matchId]` |
| QW5 | **Welcome email post-onboarding (quiz + grupos + leaderboard)** | Orienta al usuario nuevo y dispara la primera interacción | Bajo | Alto | patrón de `result-email-template.ts` |
| QW6 | **Link "Invitar a grupo" desde la fila propia del leaderboard** | Momento natural de invitar; quita un salto de navegación → crece membresía de grupos | Bajo | Alto | `leaderboard-table.tsx`, `group-controls.tsx` |
| QW7 | **Toggles de preferencias de email in-app (por tipo)** | Reduce el arrepentimiento del unsubscribe total; mantiene al usuario en el ecosistema | Bajo/Med | Med | `components/user-menu.tsx`, perfil |
| QW8 | **Empty state en `/matches`: "Haz tu primer pick" + partidos de hoy** | Reduce time-to-first-prediction tras onboarding | Bajo | Med | `/matches` |
| QW9 | **Mensaje útil en estado vacío del filtro "Needs Pick"** ("todo cerrado, vuelve mañana" + link a "todos los partidos") | Evita el dead-end silencioso que suprime el re-engagement | Bajo | Bajo/Med | `needs-pick-toggle.tsx` |

### Apuestas medianas (medio esfuerzo / alto impacto)

| # | Palanca | Por qué | Esfuerzo | Impacto |
|---|---|---|---|---|
| M1 | **Badge "se cierra en 5 min" + toast de urgencia** en filas de partido | Urgencia visual/temporal → acción inmediata antes del lock | Med | Alto |
| M2 | **Leaderboard en tiempo real (Supabase Realtime sobre `v_leaderboard_overall`)** | FOMO durante jornadas; razón para dejar la página abierta | Med | Alto |
| M3 | **Notificación de cambio de rank ("subiste 3 puestos, ahora #7")** | Momento de descubrimiento → re-engagement; se engancha al result email | Med | Alto |
| M4 | **Recompensa por referido en grupos (+pts a invitador e invitado)** | Cierra el loop viral; multiplica crecimiento de grupos (requiere `invited_by_user_id`) | Med | Alto |
| M5 | **Invitación a grupo por email con join link directo** | Elimina la fricción copiar-pegar; reusa infra de emails existente | Med | Alto |
| M6 | **Segmentar recordatorios por zona horaria (≈7am local)** | El nudge llega cuando el usuario está despierto y propenso a usar la app | Med/Alto | Alto |
| M7 | **Digest de resultados diario (top 5, tu rank, mayores movimientos)** | Touchpoint diario que recupera a quien no entró ese día | Med | Alto |
| M8 | **Streak counter de predicciones (días con ≥1 pick, reset semanal)** | Da razón para entrar a diario, no solo en partidos grandes | Med | Alto |
| M9 | **Email digest de recaps post-jornada (cómic + share links)** | Contenido nuevo que el usuario no sabía que existía; pico de engagement same-day | Med | Alto |
| M10 | **Leaderboard segmentado (semanal / por etapa)** | Competición fresca y alcanzable para mid-tier; los datos ya existen (matches con timestamps) | Med | Med |
| M11 | **Email de comeback a inactivos ("llevas 5 días sin predecir, estás #X")** | Reactiva churned, que hoy no reciben ningún mensaje | Med | Med |

### Apuestas grandes (más esfuerzo / impacto a confirmar)

- **Push notifications** para "nuevo partido hoy sin predecir" y "tu standing cambió" (esfuerzo alto, impacto alto) — el complemento real al email batch.
- **Streak freeze / pase semanal** para no romper la racha por un día perdido (reduce el efecto cliff).
- **Vista split-screen: Mis Picks vs. Resultados reales** + tarjetas de standing en home/dashboard.
- **Página de comparación 1-clic friend challenge** (head-to-head) con OG card.
- **Comentarios/reacciones en recaps** (social proof, "200 fans reaccionaron").
- **Filtrado de scoring por fecha de ingreso al grupo** para nivelar a los late joiners.

---

## 5. Catálogo de nuevas formas de interacción

> Cada idea anclada a algo que **ya existe** en el código para que el encaje sea natural.

### A. Social / viral
- **Recompensa por referido en grupos** — encaja sobre el modelo de grupos y join code existente (`groups/actions.ts`); falta `invited_by_user_id` y bonus al primer pick del invitado.
- **Invitación a grupo por email/SMS con deep link** — reusa la infra de `lib/notifications/*` (Resend, plantillas). Hoy `group-controls.tsx` solo copia al portapapeles.
- **"Amigos jugando" en match detail** — mostrar los picks de tu grupo para ese partido ("Alice 2-1, tú 2-0"). Se apoya en grupos + predicciones ya existentes; social proof + FOMO.
- **CTA "Comparte tu pick / tu rank" post-acción** — los botones (`share-buttons.tsx`) y las OG cards (`/api/og/*`) ya existen; solo falta surfacearlos en el flujo, no escondidos.
- **Append "Únete a mi pool" en el texto de compartir** — convierte el share de pick (hoy solo lectura) en captación.

### B. Competitivo
- **Leaderboard en tiempo real** (Supabase Realtime sobre `v_leaderboard_overall`).
- **Leaderboard segmentado**: semanal vs. global, por etapa, por precisión de fase de grupos — los datos existen (matches con timestamps, scores por match).
- **Rank delta badges (↑/↓)** en filas — requiere historizar rank (tabla nueva tipo `rank_history`); UI mínima sobre `RankBadge`.
- **Leaderboard de rachas del quiz** (ordenar por racha, no por puntos) — surfacea a los "hot players" y hace el ascenso alcanzable; vista alternativa de `v_quiz_leaderboard`.
- **Friend challenge / head-to-head** — nueva ruta `/challenge/[u1]/vs/[u2]` leyendo dos filas del leaderboard + OG card.

### C. Contenido
- **Digest de recaps post-jornada por email** — recap + cómic ya se auto-generan (`match-summary.ts`); falta el email que los anuncie.
- **Tarjeta de recap shareable propia** (`/api/og/recap?summaryId=...`) distinta del cómic — da identidad visual propia al recap.
- **News inline en match detail** — query de artículos por nombre de equipo (`lib/news.ts`) renderizados en el partido; descubrimiento orgánico sin sacar de la app.
- **Estado leído/guardado + contador de no leídos en News** — hoy el feed es stateless (`news-feed.tsx`); requiere tablas tipo `user_reads`/`user_saved`.
- **"Trending predictions" en match card** ("el marcador más elegido es 2-1, 42%") — reduce fatiga de decisión, crea señal viral.

### D. Notificaciones
- **Push** para "partido nuevo hoy sin predecir" y "tu standing cambió" — el gran hueco frente al email batch.
- **Toast/banner in-app de picks pendientes** al cargar `/matches`.
- **Email de comeback** ("llevas 5 días sin predecir, estás #X") para reactivar churned — hoy los inactivos no reciben nada.
- **Email semanal anti-lull** en días sin partidos/quiz (mantiene la cadencia del hábito cuando no hay disparador diario).
- **Deep links en emails** (`/leaderboard?tab=group&group_id=...`, `/quiz?ref=email`) + atribución en GA.

### E. Gamificación (rachas / logros / en vivo)
- **Streak de predicciones diarias** (reset semanal) — paralelo a la racha del quiz, hoy inexistente en predicciones.
- **Streak freeze / pase semanal** — segunda oportunidad para no romper la racha (campo nuevo tipo `profiles.weekly_streak_passes`).
- **Logros / badges**: "Primer exacto", "Top 10 durante 5 días", "racha de exactos" — visibles en leaderboard y como hook viral.
- **Overlay de posición tras enviar pick** ("¡Ahora eres #42, +2 desde ayer!") — micro-recompensa inmediata sobre el flujo de `submitPrediction`.
- **Plantilla pre-partido "recap llegando en 10 min"** + auto-reveal al completar el render — evita el drop-off post-partido cuando el usuario está en pico emocional.
- **Gamificar respuestas erróneas del quiz** ("el 60% falló esto" + explicación) — convierte el fallo en aprendizaje, reduce frustración.

---

## 6. Métricas a instrumentar

> **Estado actual: prácticamente sin analítica de producto.** GA está integrado pero solo carga el page view base — verificado que **no existe ningún `gtag('event', ...)`** personalizado en `app/` ni `components/` (en `app/layout.tsx:165-179` solo `gtag('js')` y `gtag('config')`). Tampoco hay tracking de aperturas/clics de email ni de clics de compartir. **Sin esto, ninguna palanca de las secciones 4-5 es medible ni optimizable.**

### Funnel de activación (lo primero)
- `sign_in_started` → `sign_in_completed` → `onboarding_completed` → `first_prediction_submitted` (con time-to-first-pick). Mide los 3 saltos del onboarding (fricción #9).
- Tasa de abandono por paso del onboarding.

### Engagement diario / hábito
- DAU / WAU / MAU y ratio DAU/MAU (stickiness).
- `prediction_submitted`, `quiz_answered`, `match_detail_view`, `live_feed_view`.
- Distribución de longitud de racha (quiz; y futura racha de predicciones).
- Picks por usuario por jornada; % de partidos del día predichos.

### Email / retención (motor crítico)
- Open rate, click rate, unsubscribe rate **por tipo** (prediction, quiz, result) — vía analytics de Resend.
- CTR email→app con `?ref=` y atribución a primer pick post-email.
- Cobertura: % de opted-in que efectivamente reciben (detectar los fallos silenciosos por email faltante que ya registran los dispatchers).

### Viralidad
- `share_click` por plataforma (X / Facebook / native / copy) y por tipo (pick / rank / quiz).
- Conversión share→landing→sign-in (endpoint redirect `/api/track-share` o evento + UTM).
- Coeficiente viral de grupos: invitaciones enviadas → joins → primer pick del invitado (requiere `invited_by_user_id`).

### Competitivo / social
- Vistas de leaderboard, vistas de grupo, joins de grupo, tamaño medio de grupo.
- Re-engagement tras notificación de cambio de rank (cuando exista).

### Calidad de contenido
- Vistas de recap, shares de recap (hoy: cero visibilidad), CTR de la galería de home.
- Vistas de News, clics a fuente externa (hoy sin tracking; el clic externo sale de la app sin medición).

---

## 7. Hoja de ruta sugerida

### Corto plazo (semanas 1-3) — desbloquear + medir + quick wins
1. **QW1** Configurar `EMAIL_FROM` (+ `RESEND_API_KEY`) en prod con dominio verificado (`lib/env.ts:46`). *Sin esto, nada del email funciona.*
2. **QW3** Instrumentar eventos GA del funnel y de viralidad (`app/layout.tsx`, `share-buttons.tsx`, `prediction-form.tsx`). *Sin esto, no se mide nada de lo demás.*
3. **QW2** Toast/banner in-app de picks pendientes al cargar `/matches`.
4. **QW4** CTA "Comparte tu pick" tras enviar predicción.
5. **QW5** Welcome email post-onboarding.
6. **QW6** Link "Invitar a grupo" desde el leaderboard.
7. **QW7/QW8/QW9** Toggles de preferencias de email + empty state accionable en `/matches` + mensaje útil en filtro "Needs Pick".

> **Hito de salida:** motor de email funcionando + analítica del funnel viva + 3 nudges in-app/sociales activos.

### Medio plazo (semanas 4-10) — competición fresca + loop social + cadencia
1. **M2/M3** Leaderboard en tiempo real + notificación de cambio de rank.
2. **M1** Badge "se cierra en 5 min" + toast de urgencia.
3. **M4/M5** Invitación a grupo por email + recompensa por referido (cerrar el loop viral).
4. **M8** Streak de predicciones diarias.
5. **M6** Segmentar recordatorios por zona horaria.
6. **M7/M9/M11** Digest diario de resultados + digest de recaps post-jornada + email de comeback.
7. **M10** Leaderboard segmentado (semanal / por etapa) y "Amigos jugando" en match detail.

> **Hito de salida:** DAU sostenido fuera de partidos grandes, coeficiente viral de grupos medible y >0.

### Largo plazo (semanas 10+) — push, logros y profundidad
1. **Push notifications** (partido nuevo sin predecir, cambio de standing) — el complemento real al email batch.
2. **Logros / badges** transversales + **streak freeze**.
3. **Friend challenge head-to-head** con OG card.
4. **Comentarios/reacciones en recaps** y **plantilla pre-partido** con auto-reveal.
5. **Mis Picks vs. Resultados reales** (split-screen) + bracket proyectado shareable.
6. **Filtrado de scoring por fecha de ingreso al grupo** (nivelar late joiners).
7. Caché de OG cards en blob/Redis si el volumen de shares lo justifica (optimización, no engagement directo).
