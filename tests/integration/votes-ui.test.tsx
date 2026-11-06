import { it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  ReviewVotesProvider,
  VoteControls,
} from "../../src/features/reviews/VoteControls";
import {
  VoteError,
  type ReviewVotesService,
} from "../../src/services/review-votes";
import type { PublicReview, ReviewVote } from "../../src/domain/models";
const auth = vi.hoisted(() => ({
  session: { user: { id: "voter" } } as { user: { id: string } } | null,
}));
vi.mock("../../src/features/auth/AuthContext", () => ({ useAuth: () => auth }));
const id = "60000000-0000-0000-0000-000000000001";
const review = {
  id,
  author_id: "author",
  helpful_count: 0,
  unhelpful_count: 0,
} as PublicReview;
const row: ReviewVote = {
  reviewId: id,
  value: null,
  helpfulCount: 0,
  unhelpfulCount: 0,
};
const view = (service: ReviewVotesService) =>
  render(
    <MemoryRouter>
      <ReviewVotesProvider reviews={[review]} service={service}>
        <VoteControls review={review} />
        <input aria-label="Draft" defaultValue="unchanged" />
      </ReviewVotesProvider>
    </MemoryRouter>,
  );
it("blocks double clicks and recovers committed vote after lost ACK without replacing draft", async () => {
  auth.session = { user: { id: "voter" } };
  let reject!: (reason: Error) => void;
  const service = {
    own: vi
      .fn()
      .mockResolvedValueOnce([row])
      .mockResolvedValue([{ ...row, value: 1, helpfulCount: 1 }]),
    vote: vi.fn(
      () =>
        new Promise<ReviewVote>((_r, no) => {
          reject = no;
        }),
    ),
  };
  view(service);
  const button = screen.getByRole("button", {
    name: "Votar útil",
  });
  await waitFor(() => expect(button).toBeEnabled());
  expect(screen.getByText(/Tu voto es irreversible/)).toBeVisible();
  fireEvent.click(button);
  fireEvent.click(button);
  expect(service.vote).toHaveBeenCalledTimes(1);
  expect(button).toBeDisabled();
  reject(new VoteError(503, "ACK incierto"));
  expect(await screen.findByText(/Tu voto irreversible: útil/)).toBeVisible();
  expect(screen.getByText("Útiles: 1 · No útiles: 0")).toBeVisible();
  expect(screen.getByLabelText("Draft")).toHaveValue("unchanged");
  expect(service.own).toHaveBeenCalledTimes(2);
});
it("failed recovery keeps writes disabled until explicit own retry", async () => {
  auth.session = { user: { id: "voter" } };
  const service = {
    own: vi
      .fn()
      .mockResolvedValueOnce([row])
      .mockRejectedValueOnce(new VoteError(503, "sin conexión"))
      .mockResolvedValue([row]),
    vote: vi.fn().mockRejectedValue(new VoteError(503, "ACK incierto")),
  };
  view(service);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Votar no útil" })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Votar no útil" }));
  const retry = await screen.findByRole("button", {
    name: "Comprobar voto guardado",
  });
  await waitFor(() => expect(service.own).toHaveBeenCalledTimes(2));
  expect(screen.getByRole("button", { name: "Votar útil" })).toBeDisabled();
  fireEvent.click(retry);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Votar útil" })).toBeEnabled(),
  );
  expect(service.vote).toHaveBeenCalledTimes(1);
});
it("guests see public counts and sign-in link without private own query", () => {
  auth.session = null;
  const service = { own: vi.fn(), vote: vi.fn() };
  view(service);
  expect(
    screen.getByRole("link", { name: "Inicia sesión para votar" }),
  ).toBeVisible();
  expect(service.own).not.toHaveBeenCalled();
});
it("refreshes same-ID counters while a stale own response cannot overwrite a pending or committed vote", async () => {
  auth.session = { user: { id: "voter" } };
  let resolveOwn!: (rows: ReviewVote[]) => void;
  let resolveVote!: (vote: ReviewVote) => void;
  const service = {
    own: vi
      .fn()
      .mockResolvedValueOnce([row])
      .mockImplementationOnce(
        () =>
          new Promise<ReviewVote[]>((resolve) => {
            resolveOwn = resolve;
          }),
      )
      .mockResolvedValue([{ ...row, value: 1, helpfulCount: 4 }]),
    vote: vi.fn(
      () =>
        new Promise<ReviewVote>((resolve) => {
          resolveVote = resolve;
        }),
    ),
  };
  const tree = (count: number) => (
    <MemoryRouter>
      <ReviewVotesProvider
        reviews={[{ ...review, helpful_count: count }]}
        service={service}
      >
        <VoteControls review={review} />
      </ReviewVotesProvider>
    </MemoryRouter>
  );
  const screenView = render(tree(0));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Votar útil" })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Votar útil" }));
  screenView.rerender(tree(2));
  await waitFor(() => expect(service.own).toHaveBeenCalledTimes(2));
  expect(screen.getByText("Guardando voto…")).toBeVisible();
  expect(screen.getByRole("button", { name: "Votar útil" })).toBeDisabled();
  resolveVote({ ...row, value: 1, helpfulCount: 3 });
  expect(await screen.findByText("Útiles: 3 · No útiles: 0")).toBeVisible();
  resolveOwn([{ ...row, helpfulCount: 2 }]);
  await waitFor(() =>
    expect(screen.getByText(/Tu voto irreversible: útil/)).toBeVisible(),
  );
  expect(screen.getByText("Útiles: 3 · No útiles: 0")).toBeVisible();
  screenView.rerender(tree(4));
  await waitFor(() => expect(service.own).toHaveBeenCalledTimes(3));
  await waitFor(() =>
    expect(screen.getByText("Útiles: 4 · No útiles: 0")).toBeVisible(),
  );
});
