export default function PhoneVideo({ src, className = 'w-[210px]' }) {
  return (
    <div
      className={`shrink-0 rounded-[2rem] bg-[#2a2622] p-[6px] ring-1 ring-white/10 shadow-[0_22px_38px_-14px_rgba(42,38,34,0.5)] ${className}`}
    >
      <div className="relative rounded-[1.6rem] overflow-hidden bg-black">
        <span className="absolute top-[7px] left-1/2 -translate-x-1/2 z-10 h-[6px] w-[38px] rounded-full bg-[#2a2622]/80" />
        <video
          src={src}
          controls
          playsInline
          preload="metadata"
          className="aspect-[9/19] w-full object-cover bg-black"
        />
      </div>
    </div>
  );
}