import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { checkIntersection } from 'line-intersect';

declare var require: any;

@Component({
  selector: 'app-sel-ang-brush',
  templateUrl: './sel-ang-brush.component.html',
  styleUrls: ['./sel-ang-brush.component.css']
})
export class SelAngBrushComponent implements OnInit, AfterViewInit {

  // D3
  private d3: any;

  // SVG element
  @ViewChild('lines') canvasplot: ElementRef;
  @ViewChild('selection') canvasselection: ElementRef;
  @ViewChild('plot') svgplot: ElementRef;

  // Sizes and Margins
  private svgWidth = 1200;
  private svgHeight = 700;
  private plotMargin = { top: 5, right: 0, bottom: 35, left: 200 };
  private plotWidth = this.svgWidth - this.plotMargin.left - this.plotMargin.right;
  private plotHeight = this.svgHeight - this.plotMargin.top - this.plotMargin.bottom;

  // D3 axis for positioning the axes of the parallel coordinates plot
  private axisPositioning: any;
  // List of axes of the parallel coordinates plot
  private plotAxes: any;

  // Parameters for interaction
  private axisCatchmentArea = 20;
  private maximumSelectionSize = 40;
  private minimumSelectionSize = 10;
  private selectionPolygon: any;
  private currentAxisPosition: number;
  private currentSelectionStart: any;
  private currentSelectionAxisPrevious: number;
  private currentSelectionAxisNext: number;
  private selectionIsActive = false;

  // Data
  private dataset: any;
  private dataCategories: string[];
  private polylines: Map<string,number[]>;
  private linesBetweenAxes: Map<string,number[][]>;

  /**
   * On init, get D3 and data.
   */
  ngOnInit(): void {
    // Get D3 sources
    this.d3 = require('d3');
    // Load data
    this.dataset = require('../data/cars.json');
    this.dataCategories = [];
    Object.keys(this.dataset[0]).forEach(k => { if (k !== 'name') this.dataCategories.push(k); });
  }

  /**
   * Shows the parallel coordinates plot after DOM elements have been initialised.
   */
  ngAfterViewInit(): void {
    // Set the x axis to position the axes of the parallel coordinates plot
    this.axisPositioning = this.d3.scaleBand().domain(this.dataCategories).range([0, this.plotWidth]);

    // Define the axes
    this.plotAxes = {};
    this.dataCategories.forEach(c => {
      // Find min/max for every category in the dataset
      const min = Math.min.apply(Math, this.dataset.map((e: { [x: string]: any; }) => e[c]));
      const max = Math.max.apply(Math, this.dataset.map((e: { [x: string]: any; }) => e[c]));
      // Create a D3 axis
      // @ts-ignore
      this.plotAxes[c] = this.d3.scaleLinear().domain([min, max]).range([this.plotHeight, 0]);
    });

    // Draw the lines in WebGL
    this.drawBackgroundLines();

    // Initiate SVG elements and interaction
    this.prepareSVGElements();
  }

  /**
   * Draws the lines of the parallel coordinates plot in WebGL.
   *
   * @private
   */
  private drawBackgroundLines(): void {
    // WebGL Context
    var gl = this.canvasplot.nativeElement.getContext('webgl', {
      antialias: true,
      alpha: true
    });

    // Create the vertices for the polylines
    this.polylines = new Map<string, number[]>();
    // Every entry in linesBetweenAxes represents the endpoints of the line in between two axes
    this.linesBetweenAxes = new Map<string, number[][]>();
    const vertices: number[] = [];
    // Browse through all data points
    this.dataset.forEach((e: { [x: string]: any; }) => {
      // Create a polyline for every data point
      const polyline: number[] = [];
      const lastPos = { x: 0, y: 0 };
      this.dataCategories.forEach((c,i) => {
        // Store the SVG coordinates
        if (i == 0) {
          lastPos.x = this.axisPositioning(c);
          lastPos.y = this.plotAxes[c](e[c]);
          this.linesBetweenAxes.set(e.name, []);
        } else {
          const currentLine = [];
          currentLine.push(lastPos.x);
          currentLine.push(lastPos.y);
          currentLine.push(this.axisPositioning(c));
          currentLine.push(this.plotAxes[c](e[c]));
          let mapEntry = this.linesBetweenAxes.get(e.name);
          if (mapEntry === undefined) {
            mapEntry = [];
          }
          mapEntry.push(currentLine);
          this.linesBetweenAxes.set(e.name, mapEntry);
          lastPos.x = this.axisPositioning(c);
          lastPos.y = this.plotAxes[c](e[c]);
        }
        // Store the WebGL coordinates
        const webglPosX = -1.0 + (this.axisPositioning(c) / this.plotWidth) * 2.0;
        polyline.push(webglPosX);
        const webglPosY = -1.0 + (this.plotAxes[c](e[c]) / this.plotHeight) * 2.0;
        polyline.push(webglPosY);
        polyline.push(0.0);

      });
      // Store the polyline in the vertex array
      this.polylines.set(e.name, polyline);
      polyline.forEach(p => vertices.push(p));
      // Also include a stopper for the LINE_STRIP drawing
      vertices.push(NaN);
      vertices.push(NaN);
      vertices.push(NaN);
    });

    // Vertex buffer
    var vertex_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    // Shaders - Vertex
    var vertCode =
      'attribute vec3 coordinates;' +
      'void main(void) {' +
      ' gl_Position = vec4(coordinates, 1.0);' +
      '}';
    var vertShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertShader, vertCode);
    gl.compileShader(vertShader);
    // Shaders - Fragment
    var fragCode =
      'void main(void) {' +
      'gl_FragColor = vec4(0.6, 0.6, 0.6, 0.8);' +
      '}';
    var fragShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragShader, fragCode);
    gl.compileShader(fragShader);
    // Shaders - Program
    var shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertShader);
    gl.attachShader(shaderProgram, fragShader);
    gl.linkProgram(shaderProgram);
    gl.useProgram(shaderProgram);

    // Connecting shaders and buffer objects
    gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);
    var coord = gl.getAttribLocation(shaderProgram, 'coordinates');
    gl.vertexAttribPointer(coord, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(coord);

    // Draw lines
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.enable(gl.DEPTH_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.viewport(0, 0, this.plotWidth, this.plotHeight);
    gl.drawArrays(gl.LINE_STRIP, 0, vertices.length / 3.0);
  }

  /**
   * Prepares the SVG elements and the interaction.
   *
   * @private
   */
  private prepareSVGElements(): void {
    // Clear SVG
    this.d3.select(this.svgplot.nativeElement).selectAll('*').remove();

    // Create g for drawing
    const canvas = this.d3.select(this.svgplot.nativeElement)
      .append('g')
      .attr('transform', 'translate(' + this.plotMargin.left + ',' + this.plotMargin.top + ')');

    // Draw the axes and titles
    this.dataCategories.forEach(c => {
      const posX = this.axisPositioning(c);
      // Axis
      canvas.append('g')
        .attr('transform', 'translate(' + posX + ', 0)')
        .call(this.d3.axisLeft(this.plotAxes[c]));
      // Title
      canvas.append('g')
        .attr('transform', 'translate(' + posX + ', ' + (this.svgHeight - 13) + ')')
        .append('text').attr('text-anchor', 'middle').text(c);
    });

    // Needed for interaction
    this.selectionPolygon = canvas.append('polygon')
      .attr('points', '0,0 0,0 0,0')
      .attr('fill', 'Aqua')
      .attr('stroke', 'Black')
      .attr('strokeWidth', '2px')
      .attr('opacity', 0.0);

    // Init interactions
    const pt = this.svgplot.nativeElement.createSVGPoint();
    const transf = this.svgplot.nativeElement.getScreenCTM().inverse();
    const app = this;
    this.d3.select(this.svgplot.nativeElement)
      // MOUSEDOWN
      .on('mousedown', function(evt: any) {
        // Check whether the mouse is near an axis
        pt.x = evt.clientX; pt.y = evt.clientY;
        const posInSVG = pt.matrixTransform(transf);
        app.dataCategories.forEach((c,i) => {
          if (Math.abs(app.axisPositioning(c) + app.plotMargin.left - posInSVG.x) < app.axisCatchmentArea) {
            // If yes, show the selection triangle
            app.selectionIsActive = true;
            app.selectionPolygon.attr('opacity', 0.6);
            // Remember the point on the axis
            app.currentAxisPosition = i;
            app.currentSelectionStart = { x: app.axisPositioning(c), y: posInSVG.y };
            // Remember the x positions of the previous and the next axis
            if (i == 0) {
              app.currentSelectionAxisPrevious = app.plotMargin.left;
            } else {
              app.currentSelectionAxisPrevious = app.axisPositioning(app.dataCategories[i-1]);
            }
            if (i < app.dataCategories.length - 1) {
              app.currentSelectionAxisNext = app.axisPositioning(app.dataCategories[i+1]);
            } else {
              app.currentSelectionAxisNext = app.plotWidth;
            }
            // Set the points of the selection triangle
            const selectionLine = app.getSelectionTrianglePoints(posInSVG);
            app.selectionPolygon.attr('points',
              app.currentSelectionStart.x + ',' + app.currentSelectionStart.y + ' ' +
              selectionLine.x1 + ',' + selectionLine.y1 + ' ' + selectionLine.x2 + ',' + selectionLine.y2);
            // Calculate the intersections
            app.calculateIntersections(selectionLine);
          }
        });
      })
      // MOUSEMOVE
      .on('mousemove', function(evt: any) {
        if (app.selectionIsActive) {
          // Current mouse position
          pt.x = evt.clientX;
          pt.y = evt.clientY;
          // Mouse position to SVG coordinates
          const posInSVG = pt.matrixTransform(transf);
          const posX = posInSVG.x - app.plotMargin.left;
          // Only allow interaction between the current axes and the axis to the left and to the right
          if (posX > app.currentSelectionAxisPrevious && posX < app.currentSelectionAxisNext) {
            // Set the points of the selection triangle
            const selectionLine = app.getSelectionTrianglePoints(posInSVG);
            app.selectionPolygon.attr('points',
              app.currentSelectionStart.x + ',' + app.currentSelectionStart.y + ' ' +
              selectionLine.x1 + ',' + selectionLine.y1 + ' ' + selectionLine.x2 + ',' + selectionLine.y2);
            // Calculate the intersections
            app.calculateIntersections(selectionLine);
          }
        }
      })
      // MOUSEUP
      .on('mouseup', () => {
        // Hide the selection triangle
        app.selectionIsActive = false;
        app.selectionPolygon.attr('opacity', 0.0);
        const selectedLines : number[][] = [];
        this.drawSelectedLines(selectedLines);
      });
  }

  /**
   * Returns the triangle endpoints based on the mouse position.
   *
   * @param mousePos  Current mouse position.
   *
   * @private
   */
  private getSelectionTrianglePoints(mousePos: any): any {
    // Current mouse position needs to be corrected with margin
    const mx = mousePos.x - this.plotMargin.left;
    const my = mousePos.y - this.plotMargin.top;

    // Calculate normalized vector from start to mouse position
    const vec = { x: mx - this.currentSelectionStart.x, y: my - this.currentSelectionStart.y };
    const mag = Math.sqrt(vec.x * vec.x + vec.y * vec.y);
    const nvec = { x: vec.x / mag, y: vec.y / mag };

    // Calculate the 90 degrees vector
    const nvec90 = { x: nvec.y, y: -nvec.x };

    // Check if mouse is closer to the previous or to the next axis
    const dist1 = Math.abs(mx - this.currentSelectionAxisPrevious);
    const dist2 = Math.abs(mx - this.currentSelectionAxisNext);
    // Calculate the position within the two axes
    let posBetweenAxes = 0;
    if (dist1 < dist2) {
      posBetweenAxes = (this.currentSelectionStart.x - mx) /
        (this.currentSelectionStart.x - this.currentSelectionAxisPrevious);
    } else {
      posBetweenAxes = (mx - this.currentSelectionStart.x) /
        (this.currentSelectionAxisNext - this.currentSelectionStart.x);
    }

    // Calculate the size of the selection triangle based on the distance from the original point
    const size = this.maximumSelectionSize - posBetweenAxes * (this.maximumSelectionSize - this.minimumSelectionSize);

    // Find the two endpoints of the selection line (to the left and right of the current mouse position)
    const nvec90left = { x: mx - nvec90.x * (size / 2), y: my - nvec90.y * (size / 2) };
    const nvec90right = { x: mx + nvec90.x * (size / 2), y: my + nvec90.y * (size / 2) };

    // Return points of the line
    return { x1: nvec90left.x, y1: nvec90left.y, x2: nvec90right.x, y2: nvec90right.y };
  }

  /**
   * Calculate line intersections.
   *
   * @param selectionLine The selection line defined by the selection triangle.
   *
   * @private
   */
  private calculateIntersections(selectionLine: any): void {
    const selectedLines : number[][] = [];
    // Browse through all lines
    for (let key of this.linesBetweenAxes.keys()) {
      // Get the array of line points of the current line
      const linesArray = this.linesBetweenAxes.get(key);
      // @ts-ignore
      // Proceed if there are enough points
      if (linesArray && this.currentAxisPosition < linesArray.length) {
        // First check whether polyline runs through start point
        if (Math.abs(linesArray[this.currentAxisPosition][1] - (this.plotHeight - this.currentSelectionStart.y)) < 10) {
          // Only then check for line intersection, because this is costly
          let intersectionPrevious = { type: 'undefined' };
          if (this.currentAxisPosition > 0) {
            intersectionPrevious = checkIntersection(
              selectionLine.x1, this.plotHeight - selectionLine.y1,
              selectionLine.x2, this.plotHeight - selectionLine.y2,
              linesArray[this.currentAxisPosition - 1][0], linesArray[this.currentAxisPosition - 1][1],
              linesArray[this.currentAxisPosition - 1][2], linesArray[this.currentAxisPosition - 1][3]);
          }
          const intersectionNext = checkIntersection(
            selectionLine.x1, this.plotHeight - selectionLine.y1,
            selectionLine.x2, this.plotHeight - selectionLine.y2,
            linesArray[this.currentAxisPosition][0], linesArray[this.currentAxisPosition][1],
            linesArray[this.currentAxisPosition][2], linesArray[this.currentAxisPosition][3]);
          // Both intersections to the left and right have been checked
          // If at least one is intersecting, add the line to the intersecting lines
          if (intersectionPrevious.type === 'intersecting' || intersectionNext.type === 'intersecting') {
            const vertices = this.polylines.get(key);
            if (vertices !== undefined) {
              selectedLines.push(vertices);
            }
          }
        }
      }
    }
    // Draw the selected lines on top of the background lines
    this.drawSelectedLines(selectedLines);
  }

  /**
   * Draws the currently selected lines.
   *
   * @private
   */
  private drawSelectedLines(selectedLines: number[][]): void {
    // WebGL Context
    var gl = this.canvasselection.nativeElement.getContext('webgl', {
      antialias: true,
      alpha: true
    });

    // Create the vertices for the polylines
    const vertices: number[] = [];
    // Browse through all polylines
    selectedLines.forEach(pl => {
      pl.forEach(p => vertices.push(p));
      vertices.push(NaN);
      vertices.push(NaN);
      vertices.push(NaN);
    });

    // Vertex buffer
    var vertex_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    // Shaders - Vertex
    var vertCode =
      'attribute vec3 coordinates;' +
      'void main(void) {' +
      ' gl_Position = vec4(coordinates, 1.0);' +
      '}';
    var vertShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertShader, vertCode);
    gl.compileShader(vertShader);
    // Shaders - Fragment
    var fragCode =
      'void main(void) {' +
      'gl_FragColor = vec4(0.50, 0.00, 0.00, 0.8);' +
      '}';
    var fragShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragShader, fragCode);
    gl.compileShader(fragShader);
    // Shaders - Program
    var shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertShader);
    gl.attachShader(shaderProgram, fragShader);
    gl.linkProgram(shaderProgram);
    gl.useProgram(shaderProgram);

    // Connecting shaders and buffer objects
    gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);
    var coord = gl.getAttribLocation(shaderProgram, 'coordinates');
    gl.vertexAttribPointer(coord, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(coord);

    // Draw lines
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.enable(gl.DEPTH_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.viewport(0, 0, this.plotWidth, this.plotHeight);
    gl.drawArrays(gl.LINE_STRIP, 0, vertices.length / 3.0);
  }
}
