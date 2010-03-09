/**
 * A class for warpable raster images.
 * @class
 */
Warper.Image = Class.create(
{	
	initialize: function(nodes,image) {
		this.active = false
		this.points = $A()
		this.diddit = false
		Glop.observe('glop:postdraw', this.draw.bindAsEventListener(this))
		Glop.observe('mousedown', this.click.bindAsEventListener(this))
		Glop.observe('dblclick', this.dblclick.bindAsEventListener(this))
		nodes.each(function(node) {
			this.points.push(new Warper.ControlPoint(node[0], node[1], 20, this))
		}, this)
		// remember that nodes is no longer updated!!!
		this.image = new Image()
		this.image.src = image
		this.opacity_low = 0.2
		this.opacity_high = 0.8
		this.opacity = this.opacity_high
		this.subdivisionLimit = 5
		this.patchSize = 100
	},
	/**
	 * Executes every frame; draws warped image.
	 */
	draw: function() {
		
		$C.save()
		// show image
		$C.opacity(this.opacity)
		this.update()
		$C.stroke_style('#000')
		$C.fill_style('#222')
		
		if (this.active) $C.line_width(2)
		else $C.line_width(0)
		
		$C.begin_path()
		
		$C.move_to(this.points[0].x, this.points[0].y)
		//$C.canvas.drawImage(this.image, this.points[0].x, this.points[0].y)
		this.points.each(function(point) {
			$C.line_to(point.x, point.y)
		})
		$C.line_to(this.points[0].x, this.points[0].y)

		
		
		$C.opacity(0.4)
		$C.stroke()
		
		$C.opacity(0.2)
		$C.fill()
		
		$C.restore()
	},
	/**
	 * Update transform based on position of 4 corners.
	 */
	update: function() {
		// Get extents.
		var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
		this.points.each(function(point) {
			minX = Math.min(minX, Math.floor(point.x));
			maxX = Math.max(maxX, Math.ceil(point.x));
			minY = Math.min(minY, Math.floor(point.y));
			maxY = Math.max(maxY, Math.ceil(point.y));
		});
		
		//$l($H({'minX': minX, 'minY': minY}))

		minX--; minY--; maxX++; maxY++;
		var width = maxX - minX;
		var height = maxY - minY;

		// Measure texture.
		iw = this.image.width;
		ih = this.image.height;
		

		// Set up basic drawing context.
		//$C.translate(-minX, -minY);

		transform = Warper.getProjectiveTransform(this.points);

		// Begin subdivision process.
		var ptl = transform.transformProjectiveVector([0, 0, 1]);
		var ptr = transform.transformProjectiveVector([1, 0, 1]);
		var pbl = transform.transformProjectiveVector([0, 1, 1]);
		var pbr = transform.transformProjectiveVector([1, 1, 1]);

		$C.canvas.save();
		//$C.translate(-minX, -minY)
		$C.canvas.beginPath();
		$C.canvas.moveTo(ptl[0], ptl[1]);
		$C.canvas.lineTo(ptr[0], ptr[1]);
		$C.canvas.lineTo(pbr[0], pbr[1]);
		$C.canvas.lineTo(pbl[0], pbl[1]);
		// $C.canvas.stroke();
		$C.canvas.closePath();
		$C.canvas.clip();
		
		this.divide(0, 0, 1, 1, ptl, ptr, pbl, pbr, this.subdivisionLimit);
		$C.canvas.restore()
		
	},
	/**
	 * Render a projective patch.
	 */
	divide: function(u1, v1, u4, v4, p1, p2, p3, p4, limit) {
		// See if we can still divide.
		if (limit) {
			// Measure patch non-affinity.
			var d1 = [p2[0] + p3[0] - 2 * p1[0], p2[1] + p3[1] - 2 * p1[1]];
			var d2 = [p2[0] + p3[0] - 2 * p4[0], p2[1] + p3[1] - 2 * p4[1]];
			var d3 = [d1[0] + d2[0], d1[1] + d2[1]];
			var r = Math.abs((d3[0] * d3[0] + d3[1] * d3[1]) / (d1[0] * d2[0] + d1[1] * d2[1]));

			// Measure patch area.
			d1 = [p2[0] - p1[0] + p4[0] - p3[0], p2[1] - p1[1] + p4[1] - p3[1]];
			d2 = [p3[0] - p1[0] + p4[0] - p2[0], p3[1] - p1[1] + p4[1] - p2[1]];
			var area = Math.abs(d1[0] * d2[1] - d1[1] * d2[0]);

			// Check area > patchSize pixels (note factor 4 due to not averaging d1 and d2)
			// The non-affinity measure is used as a correction factor.
			if ((u1 == 0 && u4 == 1) || ((.25 + r * 5) * area > (this.patchSize * this.patchSize))) {
				// Calculate subdivision points (middle, top, bottom, left, right).
				var umid = (u1 + u4) / 2;
				var vmid = (v1 + v4) / 2;
				var pmid = transform.transformProjectiveVector([umid, vmid, 1]);
				var pt = transform.transformProjectiveVector([umid, v1, 1]);
				var pb = transform.transformProjectiveVector([umid, v4, 1]);
				var pl = transform.transformProjectiveVector([u1, vmid, 1]);
				var pr = transform.transformProjectiveVector([u4, vmid, 1]);

				// Subdivide.
				limit--;
				this.divide(u1, v1, umid, vmid, p1, pt, pl, pmid, limit);
				this.divide(umid, v1, u4, vmid, pt, p2, pmid, pr, limit);
				this.divide(u1, vmid, umid, v4, pl, pmid, p3, pb, limit);
				this.divide(umid, vmid, u4, v4, pmid, pr, pb, p4, limit);


				return;
			}
		}

		// Render this patch.
		$C.canvas.save();

		// Set clipping path.
		$C.canvas.beginPath();
		$C.canvas.moveTo(p1[0], p1[1]);
		$C.canvas.lineTo(p2[0], p2[1]);
		$C.canvas.lineTo(p4[0], p4[1]);
		$C.canvas.lineTo(p3[0], p3[1]);
		$C.canvas.closePath();
		//$C.canvas.clip();

		// Get patch edge vectors.
		var d12 = [p2[0] - p1[0], p2[1] - p1[1]];
		var d24 = [p4[0] - p2[0], p4[1] - p2[1]];
		var d43 = [p3[0] - p4[0], p3[1] - p4[1]];
		var d31 = [p1[0] - p3[0], p1[1] - p3[1]];
		
		// Find the corner that encloses the most area
		var a1 = Math.abs(d12[0] * d31[1] - d12[1] * d31[0]);
		var a2 = Math.abs(d24[0] * d12[1] - d24[1] * d12[0]);
		var a4 = Math.abs(d43[0] * d24[1] - d43[1] * d24[0]);
		var a3 = Math.abs(d31[0] * d43[1] - d31[1] * d43[0]);
		var amax = Math.max(Math.max(a1, a2), Math.max(a3, a4));
		var dx = 0, dy = 0, padx = 0, pady = 0;

		// Align the transform along this corner.
		switch (amax) {
			case a1:
				//$l($H({'case': 'a1'}))
				$C.canvas.transform(d12[0], d12[1], -d31[0], -d31[1], p1[0], p1[1]);
				// Calculate 1.05 pixel padding on vector basis.
				if (u4 != 1) padx = 1.05 / Math.sqrt(d12[0] * d12[0] + d12[1] * d12[1]);
				if (v4 != 1) pady = 1.05 / Math.sqrt(d31[0] * d31[0] + d31[1] * d31[1]);
				break;
			case a2:
				//$l($H({'case': 'a2'}))
				$C.canvas.transform(d12[0], d12[1],  d24[0],  d24[1], p2[0], p2[1]);
				// Calculate 1.05 pixel padding on vector basis.
				if (u4 != 1) padx = 1.05 / Math.sqrt(d12[0] * d12[0] + d12[1] * d12[1]);
				if (v4 != 1) pady = 1.05 / Math.sqrt(d24[0] * d24[0] + d24[1] * d24[1]);
				dx = -1;
				break;
			case a4:
				//$l($H({'case': 'a4'}))
				$C.canvas.transform(-d43[0], -d43[1], d24[0], d24[1], p4[0], p4[1]);
				// Calculate 1.05 pixel padding on vector basis.
				if (u4 != 1) padx = 1.05 / Math.sqrt(d43[0] * d43[0] + d43[1] * d43[1]);
				if (v4 != 1) pady = 1.05 / Math.sqrt(d24[0] * d24[0] + d24[1] * d24[1]);
				dx = -1;
				dy = -1;
				break;
			case a3:
				//$l($H({'case': 'a3'}))
				// Calculate 1.05 pixel padding on vector basis.
				$C.canvas.transform(-d43[0], -d43[1], -d31[0], -d31[1], p3[0], p3[1]);
				if (u4 != 1) padx = 1.05 / Math.sqrt(d43[0] * d43[0] + d43[1] * d43[1]);
				if (v4 != 1) pady = 1.05 / Math.sqrt(d31[0] * d31[0] + d31[1] * d31[1]);
				dy = -1;
				break;
		}

		// Calculate image padding to match.
		var du = (u4 - u1);
		var dv = (v4 - v1);
		var padu = padx * du;
		var padv = pady * dv;
		
		//dx += this.points[0].x
		//dy += this.points[0].y
		
		$l($H({
			'dx, dy': Warper.p([dx, dy]),
			'px, py': Warper.p([padx, pady])
		}))
				
		if (this.image.width) {
			$C.canvas.drawImage(
				this.image,
				u1 * iw,
				v1 * ih,
				Math.min(u4 - u1 + padu, 1) * iw,
				Math.min(v4 - v1 + padv, 1) * ih,
				dx, dy,
				1 + padx, 1 + pady
			);
		}
		
		$C.canvas.restore();
	},
	
	click: function() {
		if (Geometry.is_point_in_poly(this.points, Map.pointer_x(), Map.pointer_y())) {
			this.active = true
		} else {
			this.active = false
		}
	},
	
	dblclick: function() {
		if (this.opacity == this.opacity_low) this.opacity = this.opacity_high
		else this.opacity = this.opacity_low
	}
}
)