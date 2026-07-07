export class Vector2 {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    add(other) {
        this.x += other.x;
        this.y += other.y;
        return this;
    }

    sub(other) {
        this.x -= other.x;
        this.y -= other.y;
        return this;
    }

    mult(n) {
        this.x *= n;
        this.y *= n;
        return this;
    }

    magnitude() {
        return Math.sqrt((this.x ** 2) + (this.y ** 2));
    }

    normalize() {
        let magnitude = this.magnitude();
        if (magnitude === 0) return this; // don't want to divide by 0
        this.x /= magnitude;
        this.y /= magnitude;
        return this;
    }

    dotProduct(other) {
        return (this.x * other.x) + (this.y * other.y);
    }

    clone() {
        return new Vector2(this.x, this.y);
    }

}