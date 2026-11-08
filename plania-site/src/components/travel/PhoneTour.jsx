import PhoneCarousel from '@/components/PhoneCarousel';
import PhoneMockup from './PhoneMockup';

export default function PhoneTour({ images, onOpen }) {
  return (
    <PhoneCarousel
      items={images}
      width={210}
      step={118}
      autoplayMs={4200}
      onFrontClick={onOpen}
      renderPhone={(src, isFront, i) => (
        <PhoneMockup src={src} alt={`צילום מסך ${i + 1}`} className="w-[210px]" />
      )}
      caption={(index, total) =>
        `סיור מודרך · מסך ${index + 1} מתוך ${total} · לחצו על המסך האמצעי לפתיחה מלאה`
      }
    />
  );
}
