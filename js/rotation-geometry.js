/**
 * Geometry helpers for rotation-aware layer measurements.
 */
class RotationGeometry {
  /**
   * @param {any} layer
   * @return {{x:number,y:number,width:number,height:number}}
   */
  static getRotatedBoundingRect(layer) {
    const angle = Number(layer?.rotation) || 0;
    if (!layer || !angle) {
      return {
        x: layer?.x || 0,
        y: layer?.y || 0,
        width: layer?.width || 0,
        height: layer?.height || 0,
      };
    }

    const radians = (angle * Math.PI) / 180;
    const absCos = Math.abs(Math.cos(radians));
    const absSin = Math.abs(Math.sin(radians));
    const width = Math.max(
      1,
      Math.ceil(layer.width * absCos + layer.height * absSin),
    );
    const height = Math.max(
      1,
      Math.ceil(layer.width * absSin + layer.height * absCos),
    );
    const centerX = layer.x + layer.width / 2;
    const centerY = layer.y + layer.height / 2;

    return {
      x: centerX - width / 2,
      y: centerY - height / 2,
      width,
      height,
    };
  }

  /**
   * @param {{x:number,y:number}} point
   * @param {any} layer
   * @param {{respectRotation?: boolean}} options
   * @return {{x:number,y:number}}
   */
  static mapPointToLayerLocal(point, layer, { respectRotation = false } = {}) {
    if (!respectRotation) {
      return {
        x: point.x - layer.x,
        y: point.y - layer.y,
      };
    }

    const angle = Number(layer.rotation) || 0;
    const radians = (angle * Math.PI) / 180;
    const centerX = layer.x + layer.width / 2;
    const centerY = layer.y + layer.height / 2;
    const dx = point.x - centerX;
    const dy = point.y - centerY;

    const localDX = dx * Math.cos(radians) + dy * Math.sin(radians);
    const localDY = -dx * Math.sin(radians) + dy * Math.cos(radians);

    return {
      x: localDX + layer.width / 2,
      y: localDY + layer.height / 2,
    };
  }
}

export function getRotatedBoundingRect(layer) {
  return RotationGeometry.getRotatedBoundingRect(layer);
}

export function mapPointToLayerLocal(point, layer, options) {
  return RotationGeometry.mapPointToLayerLocal(point, layer, options);
}
