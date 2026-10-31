export function StatePanel({
  kind,
  title,
  children,
}: {
  kind: "loading" | "empty" | "error";
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <section
      className={`state-panel ${kind}`}
      role={kind === "error" ? "alert" : "status"}
      aria-busy={kind === "loading"}
    >
      {kind === "loading" && (
        <span className="hive-loader" aria-hidden="true">
          ⬡
        </span>
      )}
      <h2>{title}</h2>
      {children}
    </section>
  );
}
