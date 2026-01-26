/// <reference path="./get-pixels.d.ts" />
import getPixels from 'get-pixels';
import { suggestClosestPMS } from './colors';
import logger from './logger';

const WHITE_COLOR_STR = '255,255,255';
const ONE_HUNDRED_PERCENTS = 100;
const DEFAULT_MAXIMUM_COLOR_DISTANCE = 140;
const SMALLEST_COLOR_DISTANCE = 55;
const BIGGEST_COLOR_DISTANCE = 220;
const MAXIMUM_COLORS_LOGO_MAY_HAVE = 25000;

interface NdArray {
  data: Uint8Array | Uint8ClampedArray;
  shape: number[];
  stride: number[];
  offset: number;
}

interface ColorInfo {
  amount: number;
  rgb: string;
  rgbArray: [number, number, number];
}

interface RgbObject {
  [key: string]: ColorInfo;
}

interface MajorColors {
  [key: string]: number;
}

interface MergedColors {
  [key: string]: string;
}

class ColorDetector {

  getPixelArrayFromFile(filePath: string): Promise<NdArray> {
    return new Promise((resolve, reject) => {
      getPixels(filePath, (err: Error | null, pixels: NdArray) => {
        if (err) {
          return reject(err);
        }
        return resolve(pixels);
      });
    });
  }

  async parseColors(filePath: string) {
    try {
      logger.info(`Receive parseColors, filePath — ${filePath}`);
      const NDPixels = await this.getPixelArrayFromFile(filePath);
      let transparentPixelsNumber = 0;
      const pixels = NDPixels.data;
      const rgbObject: RgbObject = {};
      const length = pixels.length;
      let colorsNumber = 0;
      let pixelsNumber = 0;
      // each pixel is represented by for number (r, g, b, a)
      for (let i = 0; i < length; i += 4) {
        const red = pixels[i];
        const green = pixels[i + 1];
        const blue = pixels[i + 2];
        const alphaChannel = pixels[i + 3];

        if (alphaChannel !== 0) {
          pixelsNumber++;
          const rgbColor = `${red},${green},${blue}`;
          if (rgbObject[rgbColor]) {
            rgbObject[rgbColor].amount++;
          } else {
            colorsNumber++;
            rgbObject[rgbColor] = {
              amount: 1,
              rgb: rgbColor,
              rgbArray: [red, green, blue],
            };
          }
        } else {
          transparentPixelsNumber++;
        }
      }
      if (colorsNumber > MAXIMUM_COLORS_LOGO_MAY_HAVE) {
        return {
          success: false,
          error: 'Detection error: Too many colors.',
          colorsCount: 9,
        }
      }
      const whitePixelsNumber =
        rgbObject[WHITE_COLOR_STR]?.amount || 0;
      const onePercent = pixelsNumber / ONE_HUNDRED_PERCENTS;
      const oneMeaningfulPercent =
        whitePixelsNumber > onePercent * 40
          ? (pixelsNumber - whitePixelsNumber) / ONE_HUNDRED_PERCENTS
          : onePercent;
      const { rgbMajorColors, mergedColors } = this.reduceGradientsToOneColor(
        rgbObject,
        onePercent,
        oneMeaningfulPercent,
      );
      const hexColors = rgbMajorColors.map((rgb) => {
        const rgbArr = rgb.split(',');
        return this.rgbHex(+rgbArr[0], +rgbArr[1], +rgbArr[2]);
      });
      const hasBackground = this.hasBackground({
        whitePixelsNumber,
        onePercent,
        transparentPixelsNumber,
      });

      const detectedColors = suggestClosestPMS(hexColors, { addCSuffix: true });

      // Add deduplication:
      const uniqueDetectedColors = Array.from(
        new Map(detectedColors.map(color => [color.pms, color])).values()
      );

      logger.info('parseColors completed');

      return {
        success: true,
        colorsCount: uniqueDetectedColors.length,
        colors: uniqueDetectedColors,
        hasBackground,
      }
    } catch (error: any) {
      logger.error(error);
      
      return {
        success: false,
        error: error.message,
      };
    }
  }

  reduceGradientsToOneColor(rgbObject: RgbObject, onePercent: number, oneMeaningfulPercent: number): { rgbMajorColors: string[]; mergedColors: MergedColors } {
    const colorsArray = Object.keys(rgbObject)
      .map((colorName) => rgbObject[colorName])
      .sort((color, nextColor) => (color.amount > nextColor.amount ? -1 : 1));
    const minimumColorPresence =
      oneMeaningfulPercent === onePercent ? onePercent / 4 : oneMeaningfulPercent;
    // pure colors are colors which were detected in the image before it was parsed for gradients
    const pureColors: { [key: string]: number } = colorsArray
      .filter((color) => color.amount > minimumColorPresence)
      .reduce((pureColorsObject, color) => {
        pureColorsObject[color.rgb] = color.amount;
        return pureColorsObject;
      }, {} as { [key: string]: number });

    const majorColors: MajorColors = {};
    const mergedColors: MergedColors = {};
    colorsArray.forEach(() => {
      const parentColorObj = colorsArray.shift();
      if (!parentColorObj) return;
      const parentColorString = parentColorObj.rgb;
      if (mergedColors[parentColorString]) {
        return;
      }

      majorColors[parentColorString] = parentColorObj.amount;
      const parentColor = parentColorObj.rgbArray;
      colorsArray.forEach((color) => {
        const childColorString = color.rgb;
        const childColor = color.rgbArray;
        // calculating distance between parent and child colors which will allow to merge them,
        // based on their amount in the image
        const maximumDistance = Math.min(
          Math.max(
            (parentColorObj.amount / color.amount / ONE_HUNDRED_PERCENTS) *
              DEFAULT_MAXIMUM_COLOR_DISTANCE,
            SMALLEST_COLOR_DISTANCE,
          ), // minimum distance to use for merge criteria
          BIGGEST_COLOR_DISTANCE,
        ); // maximum distance to use for merge criteria
        const distance = this.calculateDistance(parentColor, childColor);
        if (distance < maximumDistance) {
          majorColors[parentColorString] += color.amount;
          mergedColors[childColorString] = parentColorString; // marking this color as already merged, so we won't use in next iterations
        }
      });
    });

    const rgbMajorColors = Object.keys(majorColors).filter(
      (key) => majorColors[key] > oneMeaningfulPercent * 5 || pureColors[key],
    );

    return { rgbMajorColors, mergedColors };
  }

  componentToHex(c: number): string {
    const hex = c.toString(16);
    return hex.length === 1 ? `0${hex}` : hex;
  }

  rgbHex(r: number, g: number, b: number): string {
    const str = `#${this.componentToHex(r)}${this.componentToHex(g)}${this.componentToHex(
      b,
    )}`;
    return str.toUpperCase();
  }

  calculateDistance(c1: [number, number, number], c2: [number, number, number]): number {
    const quarter =
      Math.pow(c1[0] - c2[0], 2) +
      Math.pow(c1[1] - c2[1], 2) +
      Math.pow(c1[2] - c2[2], 2);
    return Math.sqrt(quarter);
  }

  hasBackground({ whitePixelsNumber, transparentPixelsNumber, onePercent }: { whitePixelsNumber: number; transparentPixelsNumber: number; onePercent: number }): boolean {
    return (
      whitePixelsNumber > onePercent * 10 && transparentPixelsNumber < onePercent * 2
    );
  }
}

export default ColorDetector;
