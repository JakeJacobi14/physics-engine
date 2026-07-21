import { Vector2 } from "./vector2.js";
import { gravity, circleDragCoefficient, dragK, gK, REST_THRESHOLD } from "./globals.js";
import { RigidBody } from "./rigidbody.js";


export class Polygon extends RigidBody {
    constructor(position, vertices, color, mass, bounciness, friction) {
        super(position, color, mass, bounciness, friction);
        this.type = "polygon";
        this.vertices = vertices;
        // bounding radius, set to furthest vertex
        this.radius = Math.max(...vertices.map(v => v.magnitude()));
    }



    checkBounds(canvas, dt) {
        if (this.position.y + this.vertices[3].y > canvas.height || this.position.y + this.vertices[0].y < 0) {
            this.velocity.y = 0;

        }
        // snap position
        if (this.position.y + this.vertices[3].y > canvas.height) { // ground
            this.position.y = canvas.height - this.vertices[3].y;
        } else if (this.position.y + this.vertices[0].y < 0) { // ceiling
            this.position.y = -this.vertices[0].y;
        }

        if (this.position.x + this.vertices[0].x < 0) { // left wall
            this.position.x = -this.vertices[0].x;
        } else if (this.position.x + this.vertices[1].x > canvas.width) { // right wall
            this.position.x = canvas.width - this.vertices[1].x;
        }
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
        return [
            this.position.clone().add(this.vertices[0]), this.position.clone().add(this.vertices[1]),
            this.position.clone().add(this.vertices[2]), this.position.clone().add(this.vertices[3])
        ];
    }

    // ADD FOR POLYGONS AT SOME TIME
    handleDrag(airDensity) {
        // const speed = this.velocity.magnitude();

        // if (speed > 0) {
        //     const dragForce = this.velocity.clone().mult(
        //         0.5 * airDensity * circleDragCoefficient * Math.PI * (this.radius ** 2) * speed * dragK
        //     );
        //     this.force.add(dragForce);
        // }
    }


}