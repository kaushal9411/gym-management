/**
 * Photos used on the home page. They live in `public/home/` and come from Pexels
 * (free to use commercially, no attribution required; credited in the footer anyway).
 * To swap one, replace the file with the same name, or point `src` somewhere else.
 */
export interface HomePhoto {
  src: string;
  alt: string;
  /** Natural width and height, so the layout never jumps while the photo loads. */
  w: number;
  h: number;
}

export const HERO_PHOTOS: HomePhoto[] = [
  { src: '/home/hero-ropes.jpg', alt: 'A woman and a man training with battle ropes in a gym', w: 1400, h: 932 },
  { src: '/home/hero-stretch.jpg', alt: 'A woman stretching on a mat before her workout', w: 1400, h: 933 },
  { src: '/home/hero-bench.jpg', alt: 'A man bench pressing in a busy gym', w: 1400, h: 872 },
  { src: '/home/hero-cardio.jpg', alt: 'A woman doing cardio on a machine', w: 1400, h: 933 },
];

export const GALLERY: Record<string, HomePhoto> = {
  ropes: { src: '/home/g-ropes-portrait.jpg', alt: 'A man training with battle ropes under warm lights', w: 800, h: 1200 },
  curl: { src: '/home/g-bw-curl.jpg', alt: 'Black and white portrait of a man curling a barbell', w: 800, h: 1067 },
  yoga: { src: '/home/g-yoga.jpg', alt: 'A man in a side plank yoga pose', w: 900, h: 600 },
  treadmill: { src: '/home/g-treadmill.jpg', alt: 'A man running on a treadmill by large windows', w: 900, h: 600 },
  pushup: { src: '/home/g-pushup.jpg', alt: 'A person doing a push-up on a gym floor', w: 900, h: 600 },
  barbell: { src: '/home/g-barbell.jpg', alt: 'An athlete lifting a loaded barbell', w: 900, h: 600 },
  crunch: { src: '/home/g-crunch.jpg', alt: 'A woman doing crunches on a mat', w: 900, h: 600 },
};

export const CTA_PHOTO: HomePhoto = { src: '/home/cta-ropes.jpg', alt: 'A man training with battle ropes', w: 1400, h: 933 };
