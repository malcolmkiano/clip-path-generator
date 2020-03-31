/* global Vue */

// eslint-disable-next-line no-unused-vars
let app = new Vue({
  el: '#app',
  data: {
    pathId: '',
    valueType: 'absolute',
    saved: localStorage.getItem('saved') ? JSON.parse(localStorage.getItem('saved')) : [],

    masked: Boolean(localStorage.getItem('masked') === 'true') || false,

    image: null,
    canvas: { width: 0, height: 0 },
    imageSize: { width: 0, height: 0 },
    color: 255,

    points: localStorage.getItem('points') ? JSON.parse(localStorage.getItem('points')) : [],
    dragState: 'dragleave',
    copied: false
  },

  computed: {
    clipPath() {
      return `clip-path: url(#${this.pathId || 'clipPath'})`;
    },

    changed() {
      return [this.points, this.image, this.saved, this.masked];
    },

    size() {
      return [this.imageSize.width, this.imageSize.height];
    }
  },

  watch: {
    changed(data) {
      const [points, image, saved, masked] = data;
      if (points.length) localStorage.setItem('points', JSON.stringify(points));
      if (image) localStorage.setItem('image', image);
      if (saved.length) localStorage.setItem('saved', JSON.stringify(saved));
      localStorage.setItem('masked', masked);
    },

    size() {
      this.resizeArtboard();
    }
  },

  mounted: function() {
    window.onresize = this.resizeArtboard;
  },

  created: function() {
    let image = localStorage.getItem('image');
    this.onCreation = true;

    if (image) {
      let img = new Image();
      img.src= image;
      img.onload = () => {
        const { width, height } = img;
        this.imageSize = { width, height };
      };
      this.image = image;

      getImageLightness(this.image, val => {
        this.color = val > 127 ? 0 : 255;
      });
    }
  },

  methods: {
    toggleMask: function() {
      this.masked = !this.masked;
    },

    handleDrag: function(e) {
      e.preventDefault();
      this.dragState = e.type;

      if (e.type === 'drop') {

        if (this.points.length > 0 && !confirm('Adding a new image will clear your points. Proceed?')) return false;

        let dt = e.dataTransfer;
        let files = [...dt.files];
        if (files.length > 1) {
          alert('You can only work on 1 image at a time.');
        } else {
          let file = files[0];
          if (!file.type.startsWith('image')) {
            alert('You can only drop valid image files');
          } else {
            
            // file is valid
            let reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onloadend = () => {
              let img = new Image();
              img.src= reader.result;
              img.onload = () => {
                const { width, height } = img;
                this.imageSize = { width, height };
                this.resizeArtboard();
              };

              this.image = reader.result;
              this.masked = false;
              this.points = [];

              getImageLightness(this.image, val => {
                this.color = val > 127 ? 0 : 255;
              });
            };

          }
        }
      }
    },

    resizeArtboard: function(){
      if (this.image) {
        const img = document.querySelector('img');
        const {width, height} = img;
        
        const ratio = (width && this.canvas.width) ? width/this.canvas.width : 1;

        this.points = this.points.map(point => {
          return { x: point.x * ratio, y: point.y * ratio };
        });

        this.canvas = { width, height };

        this.$nextTick(() => {
          // eslint-disable-next-line no-undef
          myp5.resizeSketch();
        });
      }
    },

    clearPoints() {
      if (confirm('Are you sure you want to clear your clip-path points?')) {
        this.points = [];
        localStorage.removeItem('points');
        this.masked = false;
      }
    },

    copyCode() {
      let box = document.querySelector('#outputCode');
      const range = document.createRange();
      range.selectNode(box);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
      document.execCommand('copy');
      window.getSelection().removeAllRanges();

      this.copied = true;

      setTimeout(() => {
        this.copied = false;
      }, 2000);
    },

    copySaved(e) {
      let li = e.target.closest('li');
      let code = li.querySelector('.saved code');

      const range = document.createRange();
      range.selectNode(code);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
      document.execCommand('copy');
      window.getSelection().removeAllRanges();
    },

    saveCode() {
      const codeObj = {
        id: `#${this.pathId || 'clipPath'}`,
        code: this.output()
      };
      this.saved.push(codeObj);
    },

    deleteCode(e) {
      let li = e.target.closest('li');
      let index = li.dataset.key;

      this.saved.splice(index, 1);
    },

    output(scaled = true) {
      const aspectRatio = scaled ? this.imageSize.width / this.canvas.width : 1;

      let points = '';
      let i = 0;

      this.points.forEach(point => {
        const x = this.valueType === 'absolute' ? (
          Math.round(point.x * aspectRatio)
        ) : (
          (point.x / this.canvas.width).toFixed(3)
        );
        const y = this.valueType === 'absolute' ? (
          Math.round(point.y * aspectRatio)
        ) : (
          (point.y / this.canvas.height).toFixed(3)
        );

        points += `${x} ${y}`;
        i++;
        if (i < this.points.length) points += ', ';

      });

      const units = this.valueType === '%' ? ' clipPathUnits="objectBoundingBox"' : '';

      return `<svg width="0" height="0">
  <clipPath id="${this.pathId || 'clipPath'}"${units}>
    <polygon points="${points}"></polygon>
  </clipPath>
</svg>`;
    }
  }
});

function getImageLightness(imageSrc, callback) {
  var img = new Image();
  img.src = imageSrc;

  var colorSum = 0;

  img.onload = function() {
    // create canvas
    var canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;

    var ctx = canvas.getContext('2d');
    ctx.drawImage(this,0,0);

    var imageData = ctx.getImageData(0,0,canvas.width,canvas.height);
    var data = imageData.data;
    var r,g,b,avg;

    for(var x = 0, len = data.length; x < len; x+=4) {
      r = data[x];
      g = data[x+1];
      b = data[x+2];

      avg = Math.floor((r+g+b)/3);
      colorSum += avg;
    }

    var brightness = Math.floor(colorSum / (this.width*this.height));
    callback(brightness);
  };
}

const s = ( sketch ) => {

  sketch.setup = () => {
    let cnv = sketch.createCanvas(app.canvas.width || 0, app.canvas.height || 0);
    cnv.parent('workspace');
  };
  
  sketch.draw = () => {
    sketch.clear();
    if (app.image) {
      sketch.stroke(app.color);
      sketch.noFill();
      app.points.forEach(point => {
        sketch.ellipse(point.x, point.y, 5, 5);
      });
      sketch.beginShape();
      app.points.forEach(point => {
        sketch.vertex(point.x, point.y);
      });
      if (sketch.mouseX >= 0 && sketch.mouseY >= 0 && sketch.mouseX <= app.canvas.width && sketch.mouseY <= app.canvas.height){
        sketch.vertex(sketch.mouseX, sketch.mouseY);
      }
      sketch.endShape();
    }
  };
  
  sketch.mouseClicked = () => {
    if (app.image) {
      if (sketch.mouseX >= 0 && sketch.mouseY >= 0 && sketch.mouseX <= app.canvas.width && sketch.mouseY <= app.canvas.height){
        const point = { x: sketch.mouseX, y: sketch.mouseY };
        app.points.push(point);
      }
    }
  };
  
  sketch.resizeSketch = () => {
    sketch.resizeCanvas(app.canvas.width, app.canvas.height);
  };

};

// eslint-disable-next-line no-undef
let myp5 = new p5(s);
