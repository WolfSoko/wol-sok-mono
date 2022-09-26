export class Vector2d {
  public static zero = new Vector2d(0.0, 0.0);

  public static create(x: number, y: number) {
    return new Vector2d(x, y);
  }

  public add(vector: Vector2d) {
    return new Vector2d(this.x + vector.x, this.y + vector.y);
  }

  public sub(vector: Vector2d) {
    return new Vector2d(this.x - vector.x, this.y - vector.y);
  }

  public mul(num: number) {
    return new Vector2d(this.x * num, this.y * num);
  }

  public scaleTo(scaleVector: Vector2d) {
    const norm = this.norm();
      new Vector2d(norm.x * scaleVector.x, norm.y * scaleVector.y);
  }

  public div(num: number) {
    return new Vector2d(this.x / num, this.y / num);
  }

  public length() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  public dist(vector: Vector2d) {
    return Math.abs(vector.sub(this).length());
  }

  public directionTo(vector: Vector2d) {
    return this.sub(vector).norm();
  }

  public norm() {
    return this.div(this.length());
  }

  public scalar(vec: Vector2d) {
    return this.x * vec.x + this.y * vec.y;
  }

  constructor(public x: number, public y: number) {}
}
