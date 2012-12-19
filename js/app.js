$(window).load(function(){
ko.bindingHandlers['jqIsotope'] = {
    'update': function (element, valueAccessor, allBindingsAccessor, viewModel) {
        var options = ko.utils.unwrapObservable(valueAccessor());
        if (options) {
            if (Object.prototype.toString.call(options) === '[object Array]') {
                $.fn.isotope.apply($(element), options);
            } else {
                $(element).isotope(options);
            }
        }
    }
};

$(function() {
    function Service(name) {
        var self = this;
        self.name = ko.observable(name);
        self.watch = ko.observable(new timer());       
    }
    var timer = function () {
        this.started = new ko.observable(false);
        this.totalSeconds = new ko.observable(0);

        this.seconds = new ko.dependentObservable(function () {
            return (this.totalSeconds() % 60).toFixed(0);
        }, this);

        this.secondsDisplay = new ko.dependentObservable(function () {
            var secs = this.seconds();
            var display = '' + secs;
            if (secs < 10) { display = '0' + secs; }

            // Hack for weird edge case because of setInterval.
            if (display == '010') { display = '10'; }

            return display;
        }, this);

        this.minutes = new ko.dependentObservable(function () {
            return ((this.totalSeconds() / 60) % 60).toFixed(0);
        }, this);

        this.hours = new ko.dependentObservable(function () {
            return (((this.totalSeconds() / 60) / 60) % 60).toFixed(0);
        }, this);

        this.secondHandAngle = new ko.dependentObservable(function () {
            return this.seconds() * 6;
        }, this);

        this.minuteHandAngle = new ko.dependentObservable(function () {
            return this.minutes() * 6;
        }, this);

        this.hourHandAngle = new ko.dependentObservable(function () {
            return this.hours() * 6;
        }, this);

        this.alarm = function () {
            log('alarm fired');
        };
    }

    timer.prototype.start = function () {
            this.started(true);
            this.startTime = new Date();
            var self = this;
         
            this.intervalId = setInterval(function () {
                var oldTime = self.startTime;
                self.startTime = new Date();
         
                var diff = secondsBetween(self.startTime, oldTime);
                var currSeconds = self.totalSeconds();
                self.totalSeconds(currSeconds + diff);
            }, 100);
        }
    // timer.stop
    timer.prototype.stop = function () {
        this.started(false);
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
    }
     
    // helper...
    function secondsBetween(date1, date2) {
        return (date1.getTime() - date2.getTime()) / 1000;
    }


    function ViewModel() {
        var self = this;
        self.newName = ko.observable();
        self.services = ko.observableArray([]);
        self.isotope = ko.observable();
        
        self.addService = function() {
            self.services.push(new Service(self.newName()));
        };
        
        self.toggleTimer = function(service) {
             service.watch().started() ? service.watch().stop() : service.watch().start();
        }


        self.removeService = function(service) {
            self.services.remove(service);
        };
        self.testService = function(service) {
            //self.timer.start();
            service.watch().start();
            console.log(service.watch().secondsDisplay());

            console.log(service);   
            //console.log(service);
            //service.totalSeconds(service.totalSeconds() + 1);
            //service.timer.start();


        };

        self.sortByName = function() {
            self.isotope({
                sortBy: 'name'
            });
        };
        self.sortByDuration = function() {
            $('#container').isotope({
                sortBy: 'duration'
            });
        };
        self.sortByID = function() {
            $('#container').isotope({
                sortBy: 'id'
            });
        };
        self.sortAsc = function() {
            self.isotope({
                sortAscending: true
            });
        };
        self.sortDesc = function() {
            self.isotope({
                sortAscending: false
            });
        };

        // events
        self.serviceAdded = function(el) {
            if (el && el.nodeType === 1) {
                $('#container').isotope('appended', $(el), function () {
                    self.isotope({ sortBy: self.sortBy() });
                    self.isotope({ sortAscending: !!(self.sortDir() === 'ascending') });                   
                });
            }
        };
        self.serviceRemoved = function(el) {
            if (el && el.nodeType === 1) {
                self.isotope(['remove', $(el)]);
            }
        };

        // constructor

        function _init() {
            self.services.push(new Service('Brian'));

            
            self.isotope({
                layoutMode: 'fitRows',
                itemSelector: '.element',
                animationEngine: 'best-available',
                getSortData: {
                    name: function($elem) {
                        return $elem.find('.name').text();
                    },
                    duration: function($elem) {
                        return parseInt($elem.find('.duration').text(), 10);
                    },
                    id: function($elem) {
                        return parseInt($elem.find('.id').text(), 10);
                    }
                }
            });
        }

        _init();
    }

    var vm = new ViewModel();
    ko.applyBindings(vm, document.getElementById('root'));
});
});