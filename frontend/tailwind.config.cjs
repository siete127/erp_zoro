/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        // 🎨 COLORES PTC
        ptc: {
          yellow: "#C6A148",
          blue: "#092052",
          red: "#511517",
        },

        // 🎨 COLORES REMA
        rema: {
          orange1: "#C67C3F",
          gray1: "#E7E8E9",
          gray2: "#656468",
          gray3: "#C1BFBE",
          orange2: "#AA6330",
          orange3: "#F0832F",
          red: "#843A25",
          blue: "#353082",
        },
      },
    },
  },
  plugins: [],
}
