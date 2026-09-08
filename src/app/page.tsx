export default function Home() {
  return (
    <main className="min-h-screen bg-[#f7f3ea] text-[#222a2d]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8 sm:px-10 sm:py-12">
        <header className="flex items-center justify-between">
          <p className="text-sm font-semibold tracking-[0.24em] text-[#6b1f2a]">
            COMPASS
          </p>
          <span className="rounded-full border border-[#d8d7cb] bg-[#fffdf8] px-3 py-1 text-xs font-medium text-[#59636a]">
            New frontend foundation
          </span>
        </header>

        <section className="flex flex-1 items-center py-20">
          <div className="max-w-2xl">
            <p className="mb-5 text-sm font-semibold uppercase tracking-[0.18em] text-[#36584b]">
              University of Camarines Norte
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-[#222a2d] sm:text-6xl">
              Guidance and counseling support, one step at a time.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[#59636a]">
              The new COMPASS web application is ready for its typed API client,
              authenticated portal, and accessible student and staff workflows.
            </p>
          </div>
        </section>

        <footer className="border-t border-[#d8d7cb] pt-5 text-sm text-[#59636a]">
          Built for the UCN Guidance and Counseling Office.
        </footer>
      </div>
    </main>
  );
}
