import { Vector2 } from "./vector2.js";
import { gravity, circleDragCoefficient, dragK, gK, REST_THRESHOLD } from "./globals.js";
import { RigidBody } from "./rigidbody.js";


export class Polygon extends RigidBody {
    constructor(position, vertices, color, mass, bounciness, friction) {
        super(position, color, mass, bounciness, friction);
        this.type = "polygon";
        this.vertices = vertices;
        // "radius" is set to the size
        const sideLength = this.vertices[0].clone().sub(this.vertices[1]).magnitude() / 2;
        this.radius = sideLength;
    }



    getBounds() {
        const worldVerts = this.getWorldVertices();
        let minX = Infinity; 
        let minY = Infinity;
        let maxX = -Infinity; 
        let maxY = -Infinity;

        for (const v of worldVerts) {
            if (v.x > maxX) maxX = v.x;
            if (v.x < minX) minX = v.x;

            if (v.y > maxY) maxY = v.y;
            if (v.y < minY) minY = v.y;
        }
        return {minX, maxX, minY, maxY}; // as an object, not an array
    }

    draw(ctx) {
        const worldVerts = this.getWorldVertices();
        ctx.beginPath();
        ctx.moveTo(worldVerts[0].x, worldVerts[0].y);
        for (let i = 1; i < worldVerts.length; i++) {
            ctx.lineTo(worldVerts[i].x, worldVerts[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = this.color;
        ctx.fill();

    }

    // convert local vertex position to world position
    getWorldVertices() {
        return this.vertices.map(v => this.position.clone().add(v));
    }

    // ADD FOR POLYGONS AT SOME TIME
    handleDrag(airDensity) {
        const speed = this.velocity.magnitude();

        if (speed > 0)  {
            const dragForce = this.velocity.clone().mult(
                0.5 * airDensity * 1.05 * ((this.radius * 2) ** 2) * speed * dragK // radius is width, 1.05 is a temporary drag coefficient
            );
            this.force.add(dragForce);
        }
    }


}