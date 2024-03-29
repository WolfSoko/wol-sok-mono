export function vec2(x = 0, y = 0): Vector2d {
  return Vector2d.create(x, y);
}

export class Vector2d {
  public static zero: Vector2d = new Vector2d(0.0, 0.0);

  public static create(x: number, y: number): Vector2d {
    return new Vector2d(x, y);
  }

  public add(vector: Vector2d): Vector2d {
    return new Vector2d(this.x + vector.x, this.y + vector.y);
  }

  public sub(vector: Vector2d): Vector2d {
    return new Vector2d(this.x - vector.x, this.y - vector.y);
  }

  public mul(num: number): Vector2d {
    return new Vector2d(this.x * num, this.y * num);
  }

  public vMul(mulVector: Vector2d): Vector2d {
    return new Vector2d(this.x * mulVector.x, this.y * mulVector.y);
  }

  public div(num: number): Vector2d {
    return new Vector2d(this.x / num, this.y / num);
  }

  public vDiv(mulVector: Vector2d): Vector2d {
    return new Vector2d(this.x / mulVector.x, this.y / mulVector.y);
  }

  public length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  public dist(vector: Vector2d): number {
    return Math.abs(vector.sub(this).length());
  }

  public directionTo(vector: Vector2d): Vector2d {
    return this.sub(vector).norm();
  }

  public orthogonalTo(vector: Vector2d): Vector2d {
    const dirTo: Vector2d = this.directionTo(vector);
    return new Vector2d(dirTo.y, -dirTo.x);
  }

  public rotate(angle: number): Vector2d {
    const x: number = this.x * Math.cos(angle) - this.y * Math.sin(angle);
    const y: number = this.x * Math.sin(angle) + this.y * Math.cos(angle);
    return new Vector2d(x, y);
  }

  public norm(): Vector2d {
    return this.div(this.length());
  }

  public scalar(vec: Vector2d): number {
    return this.x * vec.x + this.y * vec.y;
  }

  constructor(
    public x: number,
    public y: number
  ) {}
}
