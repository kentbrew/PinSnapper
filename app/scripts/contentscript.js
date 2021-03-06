'use strict';

var SnapUI = function(options) {
    this.init();
    this.uploadCallback = options.uploadCallback;

    // Bind event callbacks to this object.
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
};
SnapUI.prototype = {
    init: function() {
        this.dragging = false;
        this.div = null;
        this.mask = null;
        this.dimmer = null;
        this.preview = null;
        this.snap = null;
        this.closer = null;
        this.x = null;
        this.y = null;
        this.gotPreview = false;
        this.snapCoords = null;
        this.snapCtx = null;
        this.snapImg = null;
    },
    showPreview: function(clientX, clientY, doUpload) {
        this.snapCoords = {
            x: Math.min(this.x, clientX),
            y: Math.min(this.y, clientY),
            w: Math.max(this.x, clientX) - Math.min(this.x, clientX),
            h: Math.max(this.y, clientY) - Math.min(this.y, clientY),
        };

        Math.round(this.snapCoords.w * (this.snapCoords.w / this.snapCoords.h));
        if (!this.snap) {
            this.snap = document.createElement('canvas');
        }
        this.snap.setAttribute('class', 'selection');
        this.snap.setAttribute('width', this.snapCoords.w);
        this.snap.setAttribute('height', this.snapCoords.h);
        this.snap.style.top = this.snapCoords.y - 1 + 'px';
        this.snap.style.left = this.snapCoords.x - 1 + 'px';
        this.div.appendChild(this.snap);
        var self = this;
        this.snap.addEventListener('click', function () {
            self.div.removeChild(this);
            self.gotPreview = false;
        });
        this.snapCtx = this.snap.getContext('2d');
        this.snapCtx.drawImage(this.snapImg,
                               this.snapCoords.x, this.snapCoords.y, this.snapCoords.w, this.snapCoords.h,
                               0, 0, this.snapCoords.w, this.snapCoords.h);

        if (doUpload) {
            var snapImageData = this.snap.toDataURL('image/jpeg');
            this.uploadCallback.call(undefined, snapImageData);
            this.stop();
        }

        this.gotPreview = true;
    },
    onMouseUp: function(evt) {
        this.dragging = false;
        this.showPreview(evt.clientX, evt.clientY, true);
        this.closer.classList.remove('hidden');
    },
    onMouseDown: function(evt) {
        this.dragging = true;
        this.closer.classList.add('hidden');
        if (this.snap) {
            this.div.removeChild(this.snap);
            this.snap = null;
        }
        this.x = evt.clientX;
        this.y = evt.clientY;
        this.snapCoords = null;
    },
    onMouseMove: function(evt) {
        if (this.dragging) {
            this.showPreview(evt.clientX, evt.clientY, false);
        }
    },
    stop: function() {
        if (this.div) {
            this.y = this.x = null;
            this.mask.removeEventListener('mousedown', this.onMouseDown, false);
            this.mask.removeEventListener('mousemove', this.onMouseMove, false);
            this.mask.removeEventListener('mouseup', this.onMouseUp, false);
            document.body.removeChild(this.div);
            this.div = null;
            this.gotPreview = false;
        }
    },
    injectStylesheet: function() {
        // Inject the stylesheet if not already
        if (!document.getElementById('pinSnapperStylesheet')) {
            var ss = document.createElement('link');
            ss.setAttribute('id', 'pinSnapperStylesheet');
            ss.type = 'text/css';
            ss.rel = 'stylesheet';
            ss.href = chrome.extension.getURL('styles/pinsnapper.css');
            document.getElementsByTagName('head')[0].appendChild(ss);
        }
    },
    begin2: function(snapImg) {
        this.injectStylesheet();

        this.init();

        this.snapImg = snapImg;

        this.gotPreview = false;
        this.div = document.createElement('div');
        this.div.setAttribute('class', 'pinSnapperOverlay');
        document.body.appendChild(this.div);

        this.mask = document.createElement('div');
        this.mask.setAttribute('class', 'mask');
        this.div.appendChild(this.mask);

        this.dimmer = document.createElement('div');
        this.dimmer.setAttribute('class', 'dimmer');
        this.div.appendChild(this.dimmer);

        this.closer = document.createElement('div');
        this.closer.setAttribute('class', 'close');
        this.div.appendChild(this.closer);

        this.mask.addEventListener('mousedown', this.onMouseDown, false);
        this.mask.addEventListener('mousemove', this.onMouseMove, false);
        this.mask.addEventListener('mouseup', this.onMouseUp, false);

        var self = this;
        this.closer.addEventListener('click', function () {
            self.stop();
        });
    },
    begin: function(screenshotDataUri) {
        // if we're already waiting for a drag, ignore requests.
        if (this.div) {
            return;
        }

        var snapImg = document.createElement('img');
        var self = this;
        snapImg.onload = function() {
            self.begin2(snapImg);
        };
        snapImg.setAttribute('src', screenshotDataUri);
    }
};

var pinterest = {
    createPin: function(pinUrl, pinImageDataUri) {
        function receiveMessage(event) {
            if (event.source !== popup) {
                return;
            }
            if (event.data === 'pinterestReady') {
                var payload = {
                    type: 'pinImageData',
                    dataUri: pinImageDataUri
                };
                popup.postMessage(payload, '*');
                window.removeEventListener('message', receiveMessage, false);
            }
        }
        window.addEventListener('message', receiveMessage, false);

        var host = 'www.pinterest.com';
        var title = document.title;
        var url = 'http://' + host + '/pin/create/extension/?url=' + encodeURIComponent(pinUrl) + '&description=' + encodeURIComponent(title);
        var popupOptions = 'status=no,resizable=yes,scrollbars=yes,personalbar=no,directories=no,location=no,toolbar=no,menubar=no,width=632,height=270,left=0,top=0';
        var popup = window.open(url, 'pin' + (new Date()).getTime(), popupOptions);
    }
};

var snapUI = new SnapUI({
    uploadCallback: function(imageDataUri) {
        pinterest.createPin(window.location.href, imageDataUri);
    }
});

chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
    console.log('extension.onRequest action', request.action);
    if ('pinSnap' === request.action) {
        snapUI.begin(request.screenshotDataUri);
    }
    sendResponse({
        response: 'hello'
    });
});
