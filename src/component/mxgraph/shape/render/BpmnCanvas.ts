/**
 * Copyright 2020 Bonitasoft S.A.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { StyleDefault } from '../../StyleUtils';
import { IconConfiguration, IconStyleConfiguration, ShapeConfiguration, Size } from './render-types';

export interface BpmnCanvasConfiguration {
  mxCanvas: mxAbstractCanvas2D;
  shapeConfiguration: ShapeConfiguration;
  iconConfiguration: IconConfiguration;
}

/**
 * Compute the icon size proportionally to a ratio of the shape size. The proportions of the icon are left untouched.
 */
export function computeScaledIconSize(initialIconSize: Size, iconStyleConfiguration: IconStyleConfiguration, shapeConfiguration: ShapeConfiguration, ratioFromShape: number): Size {
  let iconWidthProportionalToShape;
  let iconHeightProportionalToShape;
  if (initialIconSize.height < initialIconSize.width || (initialIconSize.height == initialIconSize.width && shapeConfiguration.w <= shapeConfiguration.h)) {
    iconWidthProportionalToShape = shapeConfiguration.w;
    iconHeightProportionalToShape = (shapeConfiguration.w * initialIconSize.height) / initialIconSize.width;
  } else {
    iconWidthProportionalToShape = (shapeConfiguration.h * initialIconSize.width) / initialIconSize.height;
    iconHeightProportionalToShape = shapeConfiguration.h;
  }

  const inset = iconStyleConfiguration.strokeWidth ? (iconStyleConfiguration.strokeWidth - 1) * 2 : 0;
  const paintIconWidth = iconWidthProportionalToShape * ratioFromShape - inset;
  const paintIconHeight = iconHeightProportionalToShape * ratioFromShape - inset;
  return { width: paintIconWidth, height: paintIconHeight };
}

/**
 * Wrapper of {@link mxAbstractCanvas2D} to simplify method calls when painting icons/markers of BPMN shapes.
 *
 * It can scale dimensions passed to the method of the original {@link mxAbstractCanvas2D}
 *
 * @example vanilla canvas calls when a scale factor must be applied to positions
 * const scaleX = 0.26;
 * const scaleY = 0.35;
 * c.moveTo(8 * scaleX, 39 * scaleY);
 * c.lineTo(12 * scaleX, 25 * scaleY);
 *
 * @example with `BpmnCanvas`
 * const canvas = new BpmnCanvas(c, 0.26, 0.35);
 * canvas.moveTo(8, 39);
 * canvas.lineTo(12, 25);
 */
export default class BpmnCanvas {
  private c: mxAbstractCanvas2D;

  private readonly iconOriginalSize: Size;
  private readonly scaleX: number;
  private readonly scaleY: number;

  private iconPaintingOriginX = 0;
  private iconPaintingOriginY = 0;

  private readonly shapeConfiguration: ShapeConfiguration;

  constructor({ mxCanvas, shapeConfiguration, iconConfiguration }: BpmnCanvasConfiguration) {
    this.c = mxCanvas;
    this.shapeConfiguration = shapeConfiguration; // TODO clone?

    this.iconOriginalSize = iconConfiguration.originalSize;

    const ratioFromShape = iconConfiguration.ratioFromShape;
    if (ratioFromShape) {
      const scaledIconSize = computeScaledIconSize(this.iconOriginalSize, iconConfiguration.style, this.shapeConfiguration, ratioFromShape);
      this.scaleX = scaledIconSize.width / this.iconOriginalSize.width;
      this.scaleY = scaledIconSize.height / this.iconOriginalSize.height;
    } else {
      this.scaleX = 1;
      this.scaleY = 1;
    }

    this.updateCanvasStyle(iconConfiguration.style);
    iconConfiguration.setIconOrigin(this);
  }

  /**
   * Set the icon origin to the top left corner of the shape.
   *
   * @param shapeDimensionProportion proportion of the width/height used to translate the icon origin from the shape origin.
   * @internal
   */
  setIconOriginToShapeTopLeftProportionally(shapeDimensionProportion: number): void {
    const shape = this.shapeConfiguration;
    this.iconPaintingOriginX = shape.x + shape.w / shapeDimensionProportion;
    this.iconPaintingOriginY = shape.y + shape.h / shapeDimensionProportion;
  }

  /**
   * Set the icon origin to the top left corner of the shape.
   */
  setIconOriginToShapeTopLeft(topMargin: number = StyleDefault.SHAPE_ACTIVITY_TOP_MARGIN, leftMargin: number = StyleDefault.SHAPE_ACTIVITY_LEFT_MARGIN): void {
    const shape = this.shapeConfiguration;
    this.iconPaintingOriginX = shape.x + leftMargin;
    this.iconPaintingOriginY = shape.y + topMargin;
  }

  /**
   * Set the icon origin to ensure that the icon is centered on the shape.
   */
  setIconOriginForIconCentered(): void {
    const shape = this.shapeConfiguration;
    this.iconPaintingOriginX = shape.x + (shape.w - this.iconOriginalSize.width * this.scaleX) / 2;
    this.iconPaintingOriginY = shape.y + (shape.h - this.iconOriginalSize.height * this.scaleY) / 2;
  }

  /**
   * Set the icon origin to ensure that, on the shape, the icon is horizontally centered and vertically aligned to the bottom.
   */
  setIconOriginForIconBottomCentered(bottomMargin: number = StyleDefault.SHAPE_ACTIVITY_BOTTOM_MARGIN): void {
    const shape = this.shapeConfiguration;
    this.iconPaintingOriginX = shape.x + (shape.w - this.iconOriginalSize.width * this.scaleX) / 2;
    this.iconPaintingOriginY = shape.y + (shape.h - this.iconOriginalSize.height * this.scaleY - bottomMargin);
  }

  /**
   * Set the icon origin to ensure that, on the shape, the icon is vertically aligned to the bottom and translate to the left from the horizontal center.
   */
  setIconOriginForIconOnBottomLeft(
    bottomMargin: number = StyleDefault.SHAPE_ACTIVITY_BOTTOM_MARGIN,
    fromCenterMargin: number = StyleDefault.SHAPE_ACTIVITY_FROM_CENTER_MARGIN,
  ): void {
    const shape = this.shapeConfiguration;
    this.iconPaintingOriginX = shape.x + (shape.w - this.iconOriginalSize.width * this.scaleX) / 3 - fromCenterMargin;
    this.iconPaintingOriginY = shape.y + (shape.h - this.iconOriginalSize.height * this.scaleY - bottomMargin);
  }

  /**
   * Translate the icon origin using the scale factor associated to the horizontal and vertical directions.
   *
   * The values should be given with using the icon original size (as translated values will be scaled as other values passed to method of this class).
   *
   * @param dx the horizontal translation
   * @param dy the vertical translation
   */
  translateIconOrigin(dx: number, dy: number): void {
    this.iconPaintingOriginX += this.scaleX * dx;
    this.iconPaintingOriginY += this.scaleY * dy;
  }

  private computeScaleFromOriginX(x: number): number {
    return this.iconPaintingOriginX + x * this.scaleX;
  }

  private computeScaleFromOriginY(y: number): number {
    return this.iconPaintingOriginY + y * this.scaleY;
  }

  private updateCanvasStyle({ isFilled, strokeColor, fillColor, strokeWidth }: IconStyleConfiguration): void {
    if (isFilled) {
      this.c.setFillColor(strokeColor);
    } else {
      this.c.setFillColor(fillColor);
    }

    this.c.setStrokeWidth(strokeWidth);
  }

  arcTo(rx: number, ry: number, angle: number, largeArcFlag: number, sweepFlag: number, x: number, y: number): void {
    this.c.arcTo(rx * this.scaleX, ry * this.scaleY, angle, largeArcFlag, sweepFlag, this.computeScaleFromOriginX(x), this.computeScaleFromOriginY(y));
  }

  begin(): void {
    this.c.begin();
  }

  close(): void {
    this.c.close();
  }

  curveTo(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void {
    this.c.curveTo(
      this.computeScaleFromOriginX(x1),
      this.computeScaleFromOriginY(y1),
      this.computeScaleFromOriginX(x2),
      this.computeScaleFromOriginY(y2),
      this.computeScaleFromOriginX(x3),
      this.computeScaleFromOriginY(y3),
    );
  }

  fill(): void {
    this.c.fill();
  }

  fillAndStroke(): void {
    this.c.fillAndStroke();
  }

  stroke(): void {
    this.c.stroke();
  }

  setStrokeColor(color: string): void {
    this.c.setStrokeColor(color);
  }

  setRoundLineJoin(): void {
    this.c.setLineJoin('round');
  }

  lineTo(x: number, y: number): void {
    this.c.lineTo(this.computeScaleFromOriginX(x), this.computeScaleFromOriginY(y));
  }

  moveTo(x: number, y: number): void {
    this.c.moveTo(this.computeScaleFromOriginX(x), this.computeScaleFromOriginY(y));
  }

  rect(x: number, y: number, w: number, h: number): void {
    this.c.rect(this.computeScaleFromOriginX(x), this.computeScaleFromOriginY(y), w * this.scaleX, h * this.scaleY);
  }

  roundrect(x: number, y: number, w: number, h: number, dx: number, dy: number): void {
    this.c.roundrect(this.computeScaleFromOriginX(x), this.computeScaleFromOriginY(y), w * this.scaleX, h * this.scaleY, dx, dy);
  }

  ellipse(x: number, y: number, w: number, h: number): void {
    this.c.ellipse(this.computeScaleFromOriginX(x), this.computeScaleFromOriginY(y), w * this.scaleX, h * this.scaleY);
  }

  /**
   * IMPORTANT: the cx and cy parameters (coordinates of the center of the rotation) are relative to the icon origin BUT they are not scaled!
   */
  rotate(theta: number, flipH: boolean, flipV: boolean, cx: number, cy: number): void {
    this.c.rotate(theta, flipH, flipV, this.iconPaintingOriginX + cx, this.iconPaintingOriginY + cy);
  }
}
