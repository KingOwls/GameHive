import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  reviewFixtures,
  reviewPayload,
  reviewApi,
  reviewDb,
} from "../helpers/reviews-local";
import { criterionLabels, type CriticalOptions } from "../../src/domain/models";
import { criticalFixture } from "../helpers/critical";
test.use({ trace: "off", screenshot: "off", video: "off" });
test("critical publish → second session → edit/conflict/draft → convert ordinary → withdraw/republish", async ({
  page,
  browser,
}) => {
  test.skip(
    process.env.GH_RUN_REVIEWS !== "1",
    "Requires real local Supabase, npm run test:reviews -- --e2e",
  );
  test.setTimeout(180000);
  const f = await reviewFixtures(["critic", "admin"]);
  const owner = f.accounts[0];
  const secondContext = await browser.newContext(),
    guestContext = await browser.newContext();
  const second = await secondContext.newPage(),
    guest = await guestContext.newPage();
  if (f.isolatedDocument)
    for (const context of [page.context(), secondContext, guestContext])
      await context.route(
        `**/functions/v1/catalog/games/${f.rawgId.slice(5)}`,
        (route) => route.fulfill({ json: f.isolatedDocument }),
      );
  const login = async (p: Page) => {
    await p.goto("/login");
    await p.getByLabel("Correo electrónico").fill(owner.email);
    await p.getByLabel("Contraseña", { exact: true }).fill(owner.password);
    await p
      .getByRole("button", { name: "Iniciar sesión", exact: true })
      .click();
    await expect(
      p.getByRole("heading", { name: "Tu lugar en la colmena." }),
    ).toBeVisible();
  };
  for (const p of [page, second, guest]) p.setDefaultTimeout(10000);
  const bankIds: string[] = [];
  try {
    await login(page);
    await login(second);
    for (const game of [f.manualId, f.rawgId]) {
      const path = game.startsWith("manual:")
        ? `/manual-games/${game}`
        : `/games/${game}`;
      const options = await reviewApi(
        `/functions/v1/reviews?${new URLSearchParams({ gameId: game, questions: "1" })}`,
        owner.token,
      );
      expect(options.status).toBe(200);
      let currentOptions = options.data as CriticalOptions;
      const critical = criticalFixture(currentOptions);
      await page.goto(path);
      const title = `Análisis crítico ${f.marker} ${game === f.manualId ? "manual" : "RAWG"}`;
      await page.getByLabel("Título de la reseña").fill(title);
      await page
        .getByLabel("Opinión sin spoilers")
        .fill(reviewPayload.bodyPublic);
      await page
        .getByLabel("Spoilers opcionales")
        .fill(reviewPayload.bodySpoiler);
      if (game === f.manualId) await page.getByLabel("Nota (0–10)").fill("");
      if (game === f.rawgId) {
        await page
          .getByRole("button", { name: "Publicar reseña", exact: true })
          .click();
        await expect(
          page.getByText("Reseña guardada.", { exact: true }),
        ).toBeVisible();
        await page
          .getByRole("button", {
            name: "Convertir explícitamente a análisis crítico",
          })
          .click();
        await page
          .getByLabel("Opinión sin spoilers")
          .fill(
            "Una nueva opinión pública acompaña la conversión explícita a crítica completa.",
          );
      } else
        await page
          .getByRole("button", { name: "Preparar análisis crítico completo" })
          .click();
      if (game === f.manualId) {
        await page
          .getByRole("button", { name: "Cancelar preparación crítica" })
          .click();
        await expect(page.getByLabel("Nota (0–10)")).toHaveValue("");
        await expect(page.getByLabel("Título de la reseña")).toHaveValue(title);
        await page
          .getByRole("button", { name: "Preparar análisis crítico completo" })
          .click();
      }
      for (const [key, label] of Object.entries(criterionLabels)) {
        const score = critical.criteria[key as keyof typeof criterionLabels];
        await page
          .getByLabel(`Nota de ${label}`, { exact: true })
          .fill(String(score.score));
        await page
          .getByLabel(`Explicación de ${label}`, { exact: true })
          .fill(score.explanation);
      }
      await page.getByLabel("Horas jugadas").fill("25.5");
      await page.getByLabel("He finalizado el juego").check();
      await page
        .getByLabel("Justificación de la nota editorial")
        .fill(critical.scoreReason);
      if (game === f.manualId)
        await page.getByLabel("He recibido una copia facilitada").check();
      for (const q of currentOptions.questions)
        await page
          .getByLabel(`${q.prompt} (versión ${q.version})`, { exact: true })
          .fill("Respuesta editorial propia desde un navegador real.");
      if (game === f.manualId) {
        const original = currentOptions.questions[0];
        const bankId = reviewDb(
          `insert into public.critic_questions(question_key,version,genre,prompt,position) values('${original.question_key}',${original.version + 100},'*','Pregunta editorial actualizada durante recuperación de borrador.',0) returning id;`,
        ).split("\n")[0];
        bankIds.push(bankId);
        const additional = reviewDb(
          `insert into public.critic_questions(question_key,version,genre,prompt,position) values('recovery_${f.marker}',1,'*','Pregunta editorial nueva que necesita respuesta tras reconciliar.',0) returning id;`,
        ).split("\n")[0];
        bankIds.push(additional);
        await page.route(
          "**/functions/v1/reviews?*questions=1",
          (route) =>
            route.fulfill({
              status: 503,
              json: { error: "Isolated question transport fault" },
            }),
          { times: 1 },
        );
        await page.reload();
        await expect(
          page.getByText(/No pudimos cargar las preguntas/),
        ).toBeVisible();
        await expect(
          page.getByRole("textbox", {
            name: `${original.prompt} (versión ${original.version})`,
            exact: true,
          }),
        ).toHaveValue("Respuesta editorial propia desde un navegador real.");
        await page
          .getByRole("button", { name: "Reintentar preguntas críticas" })
          .click();
        await expect(
          page.getByText(/El banco de preguntas cambió/),
        ).toBeVisible();
        await page
          .getByRole("button", {
            name: "Actualizar preguntas conservando respuestas",
          })
          .click();
        const fresh = await reviewApi(
          `/functions/v1/reviews?${new URLSearchParams({ gameId: game, questions: "1" })}`,
          owner.token,
        );
        currentOptions = fresh.data as CriticalOptions;
        for (const q of currentOptions.questions) {
          const answer = page.getByRole("textbox", {
            name: `${q.prompt} (versión ${q.version})`,
            exact: true,
          });
          await expect(answer).toHaveValue(
            q.id === additional
              ? ""
              : "Respuesta editorial propia desde un navegador real.",
          );
          if (q.id === additional)
            await answer.fill(
              "Respuesta nueva necesaria conservando el resto del trabajo.",
            );
        }
        await expect(
          page.getByRole("textbox", {
            name: "Explicación de Arte",
            exact: true,
          }),
        ).toHaveValue(critical.criteria.art.explanation);
        await expect(page.getByLabel("Horas jugadas")).toHaveValue("25.5");
      }
      await expect(page.getByText(/Media orientativa: 5.50/)).toBeVisible();
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      await page
        .getByRole("button", {
          name:
            game === f.manualId
              ? "Publicar reseña"
              : "Guardar cambios de reseña",
          exact: true,
        })
        .click();
      let version = game === f.manualId ? 1 : 2;
      await expect(
        page.getByText(`Estado: publicada · Versión guardada: ${version}`),
      ).toBeVisible();
      await guest.goto(path);
      if (game === f.rawgId) {
        await expect(
          guest
            .getByRole("heading", { name: "Críticos", exact: true })
            .locator("..")
            .getByText(
              "Consulta los análisis publicados. Cálculo de puntuación crítica pendiente.",
              { exact: true },
            ),
        ).toBeVisible();
        await expect(
          guest.getByText("Sin evaluaciones", { exact: true }),
        ).toHaveCount(0);
      }
      const card = guest.getByRole("article").filter({
        has: guest.getByRole("heading", { name: title, exact: true }),
      });
      await expect(
        card.getByText("Análisis crítico · Sin verificación de crítico"),
      ).toBeVisible();
      await expect(card.getByText(/Nota del autor: 5.5 \/ 10/)).toBeVisible();
      await expect(
        card.getByText("Plataforma: " + critical.platform, { exact: false }),
      ).toBeVisible();
      for (const [key, label] of Object.entries(criterionLabels)) {
        await expect(
          card.getByText(
            `${label}: ${critical.criteria[key as keyof typeof criterionLabels].score} / 10`,
            { exact: true },
          ),
        ).toBeVisible();
        await expect(
          card.getByText(
            critical.criteria[key as keyof typeof criterionLabels].explanation,
            { exact: true },
          ),
        ).toBeVisible();
      }
      await expect(
        card.getByText(`Justificación editorial: ${critical.scoreReason}`, {
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        card.getByText(
          game === f.manualId ? /Copia facilitada$/ : /Copia no facilitada$/,
        ),
      ).toBeVisible();
      for (const q of currentOptions.questions) {
        await expect(
          card.getByRole("heading", { name: q.prompt, exact: true }),
        ).toBeVisible();
        await expect(
          card.getByText(`${q.provenance} · Versión ${q.version}`, {
            exact: true,
          }),
        ).toHaveCount(
          currentOptions.questions.filter(
            (other) =>
              other.version === q.version && other.provenance === q.provenance,
          ).length,
        );
      }
      await expect(
        card
          .getByText("Respuesta editorial propia desde un navegador real.", {
            exact: true,
          })
          .first(),
      ).toBeVisible();
      await expect(
        card.getByText(reviewPayload.bodySpoiler, { exact: true }),
      ).toHaveCount(0);
      await card.getByRole("button", { name: "Mostrar spoilers" }).focus();
      await guest.keyboard.press("Enter");
      await expect(
        card.getByText(reviewPayload.bodySpoiler, { exact: true }),
      ).toBeVisible();
      await guest.reload();
      await expect(
        guest.getByText(reviewPayload.bodySpoiler, { exact: true }),
      ).toHaveCount(0);
      await second.goto(path);
      await expect(
        second.getByLabel("Nota de Jugabilidad", { exact: true }),
      ).toHaveValue("2");
      await page.getByLabel("Nota de Jugabilidad", { exact: true }).fill("10");
      await page
        .getByRole("textbox", { name: "Explicación de Arte", exact: true })
        .fill("Explicación de arte editada y persistida desde el navegador.");
      await page
        .getByLabel("Justificación de la nota editorial")
        .fill(
          "Justificación editorial editada que debe aparecer en lectura pública.",
        );
      await page
        .getByLabel("He recibido una copia facilitada")
        .setChecked(game !== f.manualId);
      await page
        .getByRole("textbox", {
          name: `${currentOptions.questions[0].prompt} (versión ${currentOptions.questions[0].version})`,
          exact: true,
        })
        .fill("Respuesta editada que conserva la versión editorial histórica.");
      await page
        .getByLabel("Opinión sin spoilers")
        .fill(
          "Una segunda experiencia cambia mi opinión pública y la nota de jugabilidad.",
        );
      await page
        .getByRole("button", { name: "Guardar cambios de reseña" })
        .click();
      version++;
      await expect(
        page.getByText(`Estado: publicada · Versión guardada: ${version}`),
      ).toBeVisible();
      await guest.reload();
      await expect(
        card.getByText(
          "Explicación de arte editada y persistida desde el navegador.",
          { exact: true },
        ),
      ).toBeVisible();
      await expect(
        card.getByText(
          "Justificación editorial: Justificación editorial editada que debe aparecer en lectura pública.",
          { exact: true },
        ),
      ).toBeVisible();
      await expect(
        card.getByText(
          "Respuesta editada que conserva la versión editorial histórica.",
          { exact: true },
        ),
      ).toBeVisible();
      await expect(
        card.getByText(
          game === f.manualId ? /Copia no facilitada$/ : /Copia facilitada$/,
        ),
      ).toBeVisible();
      const draft =
        "Este borrador crítico de otra sesión debe conservarse tras un conflicto.";
      await second
        .getByRole("textbox", { name: "Explicación de Arte", exact: true })
        .fill(draft);
      await second
        .getByRole("button", { name: "Guardar cambios de reseña" })
        .click();
      await expect(
        second
          .getByRole("status")
          .filter({ hasText: "Tu reseña ya existe o cambió." }),
      ).toBeVisible();
      await second.reload();
      await expect(
        second.getByRole("textbox", {
          name: "Explicación de Arte",
          exact: true,
        }),
      ).toHaveValue(draft);
      await second
        .getByRole("button", {
          name: "Cargar versión guardada y descartar borrador",
        })
        .click();
      await expect(
        second.getByLabel("Nota de Jugabilidad", { exact: true }),
      ).toHaveValue("10");
      await page.getByRole("button", { name: "Retirar reseña" }).click();
      version++;
      await expect(
        page.getByText(`Estado: retirada · Versión guardada: ${version}`),
      ).toBeVisible();
      await guest.reload();
      await expect(
        guest.getByRole("heading", { name: title, exact: true }),
      ).toHaveCount(0);
      await page.getByRole("button", { name: "Republicar reseña" }).click();
      version++;
      await expect(
        page.getByText(`Estado: publicada · Versión guardada: ${version}`),
      ).toBeVisible();
      await guest.reload();
      await expect(guest.getByText(/Nota del autor: 6.5 \/ 10/)).toBeVisible();
      expect(
        (
          await new AxeBuilder({ page: guest })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
    }
    reviewDb(
      `update private.authz set role='user' where user_id='${owner.id}';`,
    );
    await page.reload();
    await expect(
      page.getByLabel("Nota de Jugabilidad", { exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByText(/Los criterios y el contexto crítico son de solo lectura/),
    ).toBeVisible();
    await page
      .getByLabel("Opinión sin spoilers")
      .fill(
        "Una nueva opinión básica sigue siendo editable después del cambio de rol.",
      );
    await page
      .getByRole("button", { name: "Guardar cambios de reseña" })
      .click();
    await expect(
      page.getByText("Reseña guardada.", { exact: true }),
    ).toBeVisible();
  } finally {
    await secondContext.close().catch(() => {});
    await guestContext.close().catch(() => {});
    f.cleanup();
    for (const id of bankIds)
      reviewDb(`delete from public.critic_questions where id='${id}';`);
  }
});
