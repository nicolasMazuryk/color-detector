import nearestColor from 'nearest-color';
import colorConvert from 'color-convert';

import { KEYWORD } from 'color-convert/conversions';
import { aPMS, aRGB, colorFamilies } from './colors.constants';

interface IRGBObject {
  r: number;
  g: number;
  b: number;
}

interface IRGBObjectAndAlpha extends IRGBObject {
  a: number;
}

const getColors = (str: string) => str.split(',');

function suggestClosestPMS(hexColors: string[], { addCSuffix } = { addCSuffix: false }) {
  const pantones = hexColors
    .map(removeHashSymbol)
    .map(closestPMSColorMatchingByDistance)
    .map(getComplexColorInfoByPMS);
  if (addCSuffix) {
    // @ts-ignore
    return pantones.map(addCSuffixToPantoneData);
  }
  return pantones;
}

function addCSuffixToPantoneData(pantoneData: { pms: string }) {
  const originalName = pantoneData.pms;

  return { ...pantoneData, pms: `${originalName} c` };
}

const removeHashSymbol = (str: string) => {
  if (typeof str === 'string' && str[0] === '#') {
    return str.slice(1);
  }
  return str;
};
const addHashSymbol = (str: string) => {
  if (typeof str === 'string' && str[0] === '#') {
    return str;
  }
  return `#${str}`;
};

const getComplexColorInfoByPMS = (pms: string | undefined) => ({
  id: genId(),
  pms,
  hex: addHashSymbol(PMS2HEX(pms)),
});

/**
 * Generate custom id
 * Math.random should be unique because of its seeding algorithm.
 *
 * @return {string}
 */
const genId = () => {
  return '_' + Math.random().toString(36).substr(2, 9);
};

/**
 * Utils function to get rgb values from hex
 *
 * @param hex {String}
 * @return {r,g,b}
 */
const HEX2RGBA = (hex: string): IRGBObjectAndAlpha | null => {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, function (m: string, r: string, g: string, b: string) {
    return r + r + g + g + b + b;
  });

  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
        a: 1,
      }
    : null;
};

const RGBAStringToRGBAObject = (string = ''): IRGBObjectAndAlpha => {
  const keys: Array<keyof IRGBObjectAndAlpha> = ['r', 'g', 'b', 'a'];
  const values = string.replace(/[^\d,]/g, '').split(',');

  return keys.reduce<any>((set, key, index) => {
    return {
      ...set,
      [key]: values[index] || 0,
    };
  }, {});
};

const RGBAObjectToRGBString = ({ r, g, b }: IRGBObjectAndAlpha): string =>
  `${r},${g},${b}`;

const hexToRgbaString = (hexColor: string, alpha: number): string | null => {
  const rgb = HEX2RGBA(hexColor);
  if (!rgb) {
    return null;
  }

  return `rgba(${rgb.r},${rgb.g},${rgb.b}, ${alpha})`;
};

const pantoneNumberRegexp = /^(.+[^\s])(\s?[Cc]{1})$/;

function normalizePantoneName(pms: string) {
  const lowerCasedPms = pms.toLowerCase();

  // @ts-ignore
  const unformattedPantoneFound = aPMS.indexOf(lowerCasedPms) > -1;
  if (unformattedPantoneFound) {
    return lowerCasedPms;
  }
  const pantoneNumberExtracted = pantoneNumberRegexp.exec(lowerCasedPms);
  const pantoneName = pantoneNumberExtracted && pantoneNumberExtracted[1];

  return pantoneName;
}

function findPantoneIndex(pms: string) {
  const normalizedPms = normalizePantoneName(pms);

  // @ts-ignore
  return aPMS.indexOf(normalizedPms);
}

function PMS2HEX(pms: string = '') {
  const pantoneIndex = findPantoneIndex(pms);
  if (pantoneIndex >= 0) {
    return aRGB[pantoneIndex];
  }

  return '';
}

function RGB2PMS(rgb: string) {
  // @ts-ignore
  const i = aRGB.indexOf(rgb);
  if (i >= 0) {
    return aPMS[i];
  }
  return '';
}

function RGB2HEX({ r, g, b }: { r: number; g: number; b: number }): string {
  // Ensure values are within the 0-255 range
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));

  // Convert to hex and format as 2-digit hex numbers with padding
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

const closestPMSColorMatchingByDistance = (rgb: string) => {
  let pantoneColorNotFound = true;
  let pantoneColor;
  let iteration = 0;
  let distance = 0;
  while (pantoneColorNotFound && iteration < 1000) {
    pantoneColor = PMSColorMatching(rgb, distance)[0];
    pantoneColorNotFound = !pantoneColor;
    distance += 1;
    iteration++;
  }

  return pantoneColor;
};

function PMSColorMatching(rgb: string, distance: number) {
  if (!distance) {
    distance = 16;
  }
  const a = [];
  const aDis = [];
  // exact pms
  const m = RGB2PMS(rgb);
  if (m !== '') {
    // @todo. auto generated. fix this error
    // @ts-ignore
    a[0] = m;
  }
  // search near color
  const r = parseInt(rgb.substr(0, 2), 16);
  const g = parseInt(rgb.substr(2, 2), 16);
  const b = parseInt(rgb.substr(4, 2), 16);
  for (let i = 0; i < aRGB.length; i++) {
    const rgb1 = aRGB[i];
    const r1 = parseInt(rgb1.substr(0, 2), 16);
    const g1 = parseInt(rgb1.substr(2, 2), 16);
    const b1 = parseInt(rgb1.substr(4, 2), 16);
    // 3D distance
    // @todo. auto generated. fix this error
    // @ts-ignore
    aDis[i] = Math.sqrt(Math.pow(r - r1, 2) + Math.pow(g - g1, 2) + Math.pow(b - b1, 2));
  }

  for (let i = 0; i < aDis.length; i++) {
    if (aDis[i] <= distance) {
      // @todo. auto generated. fix this error
      // @ts-ignore
      if (a.indexOf(aPMS[i]) === -1) {
        // @todo. auto generated. fix this error
        // @ts-ignore
        a.push(aPMS[i]);
      }
    }
  }

  return a;
}

function getPantoneColor(hex: string) {
  const colors = suggestClosestPMS([hex], { addCSuffix: true });

  return colors[0];
}

function getUniqueColorsNumberForSide(logos: any, texts: any, side: string) {
  const logosPerSide = logos[side];
  const textsPerSide: any[] = texts
    ? Object.values(texts).filter((text: any) => text.location === side)
    : [];
  const setOfColors = new Set();

  logosPerSide.reduce((colorsSet: Set<string>, logo: any) => {
    logo?.colors?.colorsToPrint.forEach((color: string) => {
      colorsSet.add(color);
    });
    return colorsSet;
  }, setOfColors);

  textsPerSide.reduce<any>((colorsSet: Set<string>, text: any) => {
    const color = getPantoneColor(text.color);
    // @ts-ignore
    colorsSet.add(color.pms);

    return colorsSet;
  }, setOfColors);

  return setOfColors.size;
}

export function getUniqueColorsNumberForAllSides(logos = {}, texts: any) {
  const sides = Object.keys(logos);
  const colorNumbersPerSides = {};

  for (let i = 0; i < sides.length; i++) {
    const currentSide = sides[i];
    // @ts-ignore
    colorNumbersPerSides[currentSide] = getUniqueColorsNumberForSide(
      logos,
      texts,
      currentSide,
    );
  }

  return colorNumbersPerSides;
}

function getAmountOfUniqueColorsForAllSides(logos: any, texts: any) {
  const colors = getUniqueColorsNumberForAllSides(logos, texts);

  return Object.values(colors).reduce<any>((colorsSum, number) => number + colorsSum, 0);
}

const colorFamiliesHEXMap = colorFamilies.reduce((acc: any, colorFamily: KEYWORD) => {
  acc[colorFamily] = '#' + colorConvert.keyword.hex(colorFamily);
  return acc;
}, {});

function findColorFamilyLib(hexColor: string): string {
  let searchedColorFamily;

  // @ts-ignore
  if (findColorFamilyLib[hexColor]) {
    // @ts-ignore
    return findColorFamilyLib[hexColor];
  }

  const nearestColorData = nearestColor.from(colorFamiliesHEXMap)(hexColor);

  // eslint-disable-next-line prefer-const
  // @ts-ignore
  searchedColorFamily = nearestColorData.name;

  // Cache result
  // @ts-ignore
  findColorFamilyLib[hexColor] = searchedColorFamily;

  return searchedColorFamily;
}

const getBrightnessFromHexColor = (hexColor: string): number => {
  const RED_BRIGHTNESS_RATE = 299;
  const GREEN_BRIGHTNESS_RATE = 587;
  const BLUE_BRIGHTNESS_RATE = 114;

  const rgbaColor = HEX2RGBA(hexColor);

  if (!rgbaColor) {
    return 0;
  }

  const { r, g, b } = rgbaColor;

  return (
    (r * RED_BRIGHTNESS_RATE + g * GREEN_BRIGHTNESS_RATE + b * BLUE_BRIGHTNESS_RATE) /
    1000
  );
};

export {
  PMS2HEX,
  normalizePantoneName,
  HEX2RGBA,
  hexToRgbaString,
  RGB2HEX,
  getColors,
  suggestClosestPMS,
  getComplexColorInfoByPMS,
  removeHashSymbol,
  getUniqueColorsNumberForSide,
  getAmountOfUniqueColorsForAllSides,
  RGBAStringToRGBAObject,
  RGBAObjectToRGBString,
  findColorFamilyLib,
  getBrightnessFromHexColor,
};
