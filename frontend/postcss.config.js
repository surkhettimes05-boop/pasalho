import type PostCSS from 'postcss';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

module.exports = {
  plugins: [tailwindcss, autoprefixer] as PostCSS.Plugin[],
};
