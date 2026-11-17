/** Site-wide settings: who the site is for and where to reach him (main spec §7.2). */
export const config = {
  name: 'Grégoire Tinnes',
  email: 'gregoire.tinnes@gmail.com',
  links: {
    linkedin: 'https://www.linkedin.com/in/gr%C3%A9goire-tinnes-6776a41a1/',
    github: 'https://github.com/Greg0s',
    instagram: 'https://www.instagram.com/gregoire.raw/',
  },
  /** The CV, in English only and without a phone number (main spec §8.2); added to `public/cv/` at step 10. */
  cv: '/cv/gregoire-tinnes-cv.pdf',
  /** Umami, self-hosted on Vercel, counts the visits (main spec §7.6). */
  analytics: {
    script: 'https://umami-y1mc.vercel.app/script.js',
    websiteId: 'c60d985e-7dbd-42f7-8b33-9035b01f2184',
  },
} as const;
