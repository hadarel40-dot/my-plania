// Deep burgundy stage so phone mockups stand out with real depth against the cream cards.
export default function MockupStage({ children, className = '' }) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg ${className}`}
      style={{
        background:
          'radial-gradient(80% 55% at 50% 22%, rgba(181,132,142,0.38) 0%, rgba(181,132,142,0) 70%), linear-gradient(165deg, #6e2626 0%, #4a1515 100%)',
        boxShadow:
          'inset 0 0 0 1px rgba(240,232,223,0.16), inset 0 -70px 90px -60px rgba(0,0,0,0.5)',
      }}
    >
      <div className="relative">{children}</div>
    </div>
  );
}
