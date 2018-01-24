// Copyright 2016 Google Inc.
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// 
//      http://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.


(function() {
  'use strict';

  var app = {
    isLoading: true,
    visibleCards: {},
    selectedCities: [],
    spinner: document.querySelector('.loader'),
    cardTemplate: document.querySelector('.cardTemplate'),
    container: document.querySelector('.main'),
    addDialog: document.querySelector('.dialog-container'),
    addButton: document.getElementById('butAddCity'),
    daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  };


  /*****************************************************************************
   *
   * Event listeners for UI elements
   *
   ****************************************************************************/

  document.getElementById('butRefresh').addEventListener('click', function() {
    // Refresh all of the forecasts
    app.updateForecasts();
  });

  document.getElementById('butAdd').addEventListener('click', function() {
    // Open/show the add new city dialog
    app.toggleAddDialog(true);
  });

  document.getElementById('butAddCity').addEventListener('click', function() {
    // Add the newly selected city
    var select = document.getElementById('selectCityToAdd');
    var selected = select.options[select.selectedIndex];
    app.getWoeid(selected.value, function(key) {
      var label = selected.textContent;
      if (!app.selectedCities) {
        app.selectedCities = [];
      }

      app.getForecast(key, label);
      app.selectedCities.push({ key: key, label: label });
      app.saveSelectedCities();
      app.toggleAddDialog(false);
    });
  });

  document.getElementById('butAddCancel').addEventListener('click', function() {
    // Close the add new city dialog
    app.toggleAddDialog(false);
  });

  document.getElementById('useMyLocation').addEventListener('click', function() {
    app.useMyLocation();
  });

  app.container.addEventListener('click', function(e) {
    if (e.target.type === 'button') {
      app.removeForecast(e.target.id);
    }
  });


  /*****************************************************************************
   *
   * Methods to update/refresh the UI
   *
   ****************************************************************************/

  // Toggles the visibility of the add new city dialog.
  app.toggleAddDialog = function(visible) {
    if (visible) {
      app.toggleDialogNudge(false);
      app.selectCityInDialog(null);
      app.addDialog.classList.add('dialog-container--visible');
    } else {
      app.addDialog.classList.remove('dialog-container--visible');
    }
  };

  app.toggleDialogNudge = function(visible) {
    var nudge = app.addDialog.querySelector('.dialog-nudge');
    if (visible) {
      nudge.removeAttribute('hidden');
    } else {
      nudge.setAttribute('hidden', '');
    }
  };

  app.selectCityInDialog = function(city) {
    var selector = $('#selectCityToAdd');
    if (city) {
      if (selector.find("option[value='" + city + "']").length) {
        selector.val(city).trigger('change');
      } else { 
        var newOption = new Option(city, city, true, true);
        selector.append(newOption).trigger('change');
      }
    } else {
      selector.val(null).trigger('change');
    }
  };

  app.removeForecast = function (key) {
    var card = app.visibleCards[key];

    // remove it from UI.
    card.parentNode.removeChild(card);

    // update application state.
    delete app.visibleCards[key];
    var index = app.selectedCities
      .findIndex(function(c) { return c.key === key; });
    if (index !== -1) {
      app.selectedCities.splice(index, 1);
      app.saveSelectedCities();
    }
  };

  app.getWoeid = function(label, callback) {
    var statement = 'select woeid from geo.places(1) where text="' + label + '"';
    var url = 'https://query.yahooapis.com/v1/public/yql?format=json&q=' +
        statement;
    
    if (window.caches) {
      caches.match(url).then(function (response) {
        if (response) {
          response.json().then(function (json) {
            callback(json.query.results.place.woeid);
          });
        }
      });
    }

    var request = new XMLHttpRequest();
    request.onreadystatechange = function() {
      if (request.readyState === XMLHttpRequest.DONE) {
        if (request.status === 200) {
          var response = JSON.parse(request.response);
          callback(response.query.results.place.woeid);
        }
      }
    };
    request.open('GET', url);
    request.send();
  };

  // Updates a weather card with the latest weather forecast. If the card
  // doesn't already exist, it's cloned from the template.
  app.updateForecastCard = function(data) {
    var dataLastUpdated = new Date(data.created);
    var sunrise = data.channel.astronomy.sunrise;
    var sunset = data.channel.astronomy.sunset;
    var current = data.channel.item.condition;
    var humidity = data.channel.atmosphere.humidity;
    var wind = data.channel.wind;

    var card = app.visibleCards[data.key];
    if (!card) {
      card = app.cardTemplate.cloneNode(true);
      card.classList.remove('cardTemplate');
      card.querySelector('.location').textContent = data.label;
      card.querySelector('.remove-button button').id = data.key;
      card.removeAttribute('hidden');
      app.container.appendChild(card);
      app.visibleCards[data.key] = card;
    }

    // Verifies the data provide is newer than what's already visible
    // on the card, if it's not bail, if it is, continue and update the
    // time saved in the card
    var cardLastUpdatedElem = card.querySelector('.card-last-updated');
    var cardLastUpdated = cardLastUpdatedElem.textContent;
    if (cardLastUpdated) {
      cardLastUpdated = new Date(cardLastUpdated);
      // Bail if the card has more recent data then the data
      if (dataLastUpdated.getTime() < cardLastUpdated.getTime()) {
        return;
      }
    }
    cardLastUpdatedElem.textContent = data.created;

    card.querySelector('.description').textContent = current.text;
    card.querySelector('.date').textContent = current.date;
    card.querySelector('.current .icon').classList.add(app.getIconClass(current.code));
    card.querySelector('.current .temperature .value').textContent =
      Math.round(current.temp);
    card.querySelector('.current .sunrise').textContent = sunrise;
    card.querySelector('.current .sunset').textContent = sunset;
    card.querySelector('.current .humidity').textContent =
      Math.round(humidity) + '%';
    card.querySelector('.current .wind .value').textContent =
      Math.round(wind.speed);
    card.querySelector('.current .wind .direction').textContent = wind.direction;
    var nextDays = card.querySelectorAll('.future .oneday');
    var today = new Date();
    today = today.getDay();
    for (var i = 0; i < 7; i++) {
      var nextDay = nextDays[i];
      var daily = data.channel.item.forecast[i];
      if (daily && nextDay) {
        nextDay.querySelector('.date').textContent =
          app.daysOfWeek[(i + today) % 7];
        nextDay.querySelector('.icon').classList.add(app.getIconClass(daily.code));
        nextDay.querySelector('.temp-high .value').textContent =
          Math.round(daily.high);
        nextDay.querySelector('.temp-low .value').textContent =
          Math.round(daily.low);
      }
    }
    if (app.isLoading) {
      app.spinner.setAttribute('hidden', true);
      app.container.removeAttribute('hidden');
      app.isLoading = false;
    }
  };

  app.useMyLocation = function() {
    getUserLocation()
      .then(app.selectCityInDialog);
  };


  /*****************************************************************************
   *
   * Methods for dealing with the model
   *
   ****************************************************************************/

  /*
   * Gets a forecast for a specific city and updates the card with the data.
   * getForecast() first checks if the weather data is in the cache. If so,
   * then it gets that data and populates the card with the cached data.
   * Then, getForecast() goes to the network for fresh data. If the network
   * request goes through, then the card gets updated a second time with the
   * freshest data.
   */
  app.getForecast = function(key, label) {
    var statement = 'select * from weather.forecast where woeid=' + key;
    var url = 'https://query.yahooapis.com/v1/public/yql?format=json&q=' +
        statement;
    
    if (window.caches) {
      caches.match(url).then(function (response) {
        if (response) {
          response.json().then(function updateFromCache(json) {
            var results = json.query.results;
            results.key = key;
            results.label = label;
            results.created = json.query.created;
            app.updateForecastCard(results);
          });
        }
      });
    }

    // Fetch the latest data.
    var request = new XMLHttpRequest();
    request.onreadystatechange = function() {
      if (request.readyState === XMLHttpRequest.DONE) {
        if (request.status === 200) {
          var response = JSON.parse(request.response);
          var results = response.query.results;
          results.key = key;
          results.label = label;
          results.created = response.query.created;
          app.updateForecastCard(results);
        }
      }
    };
    request.open('GET', url);
    request.send();
  };

  // Iterate all of the cards and attempt to get the latest forecast data
  app.updateForecasts = function() {
    var keys = Object.keys(app.visibleCards);
    keys.forEach(function(key) {
      app.getForecast(key);
    });
  };

  app.saveSelectedCities = function () {
    localforage.setItem('selectedCities', app.selectedCities)
      .catch(function (err) {
        console.error('Save selectedCities failed, ', err);
      });
  };

  app.getIconClass = function(weatherCode) {
    // Weather codes: https://developer.yahoo.com/weather/documentation.html#codes
    weatherCode = parseInt(weatherCode);
    switch (weatherCode) {
      case 25: // cold
      case 32: // sunny
      case 33: // fair (night)
      case 34: // fair (day)
      case 36: // hot
      case 3200: // not available
        return 'clear-day';
      case 0: // tornado
      case 1: // tropical storm
      case 2: // hurricane
      case 6: // mixed rain and sleet
      case 8: // freezing drizzle
      case 9: // drizzle
      case 10: // freezing rain
      case 11: // showers
      case 12: // showers
      case 17: // hail
      case 35: // mixed rain and hail
      case 40: // scattered showers
        return 'rain';
      case 3: // severe thunderstorms
      case 4: // thunderstorms
      case 37: // isolated thunderstorms
      case 38: // scattered thunderstorms
      case 39: // scattered thunderstorms (not a typo)
      case 45: // thundershowers
      case 47: // isolated thundershowers
        return 'thunderstorms';
      case 5: // mixed rain and snow
      case 7: // mixed snow and sleet
      case 13: // snow flurries
      case 14: // light snow showers
      case 16: // snow
      case 18: // sleet
      case 41: // heavy snow
      case 42: // scattered snow showers
      case 43: // heavy snow
      case 46: // snow showers
        return 'snow';
      case 15: // blowing snow
      case 19: // dust
      case 20: // foggy
      case 21: // haze
      case 22: // smoky
        return 'fog';
      case 24: // windy
      case 23: // blustery
        return 'windy';
      case 26: // cloudy
      case 27: // mostly cloudy (night)
      case 28: // mostly cloudy (day)
      case 31: // clear (night)
        return 'cloudy';
      case 29: // partly cloudy (night)
      case 30: // partly cloudy (day)
      case 44: // partly cloudy
        return 'partly-cloudy-day';
    }
  };

  app.useInitialData = function () {
    app.updateForecastCard(initialWeatherForecast);
    app.selectedCities = [
      { key: initialWeatherForecast.key, label: initialWeatherForecast.label },
    ];

    app.saveSelectedCities();
  };

  /*
   * Fake weather data that is presented when the user first uses the app,
   * or when the user has not saved any cities. See startup code for more
   * discussion.
   */
  var initialWeatherForecast = {
    key: '2459115',
    label: 'New York, NY',
    created: '2016-07-22T01:00:00Z',
    channel: {
      astronomy: {
        sunrise: "5:43 am",
        sunset: "8:21 pm"
      },
      item: {
        condition: {
          text: "Windy",
          date: "Thu, 21 Jul 2016 09:00 PM EDT",
          temp: 56,
          code: 24
        },
        forecast: [
          {code: 44, high: 86, low: 70},
          {code: 44, high: 94, low: 73},
          {code: 4, high: 95, low: 78},
          {code: 24, high: 75, low: 89},
          {code: 24, high: 89, low: 77},
          {code: 44, high: 92, low: 79},
          {code: 44, high: 89, low: 77}
        ]
      },
      atmosphere: {
        humidity: 56
      },
      wind: {
        speed: 25,
        direction: 195
      }
    }
  };

  localforage.getItem("selectedCities")
    .then(function (value) {
      if (value && value.length > 0) {
        app.selectedCities = value;
        app.selectedCities.forEach(function(city) {
          app.getForecast(city.key, city.label);
        });
      } else {
        app.useInitialData();
      }
    })
    .catch(function (err) {
      console.error('Load selectedCities failed, ', err);
      app.useInitialData();
    });

  if (navigator.serviceWorker) {
    navigator.serviceWorker.register('./service-worker.js')
      .then(function () {
        console.log('Service worker registered');
      });
  }

  function loadCss(url){
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = url;
    document.getElementsByTagName("head")[0].appendChild(link);
  }

  function loadScript(url, callback){
    var script = document.createElement("script")
    script.type = "text/javascript";

    var loaded;
    if (callback) {
      script.onreadystatechange = script.onload = function() {
        if (!loaded) {
          callback();
        }
        loaded = true;
      };
    }

    script.src = url;
    document.getElementsByTagName("head")[0].appendChild(script);
  }

  function prepareCitySelection() {
    loadScript('https://ajax.googleapis.com/ajax/libs/jquery/3.2.1/jquery.min.js', function () {
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/select2/4.0.6-rc.0/js/select2.min.js', function () {
        loadCss('https://cdnjs.cloudflare.com/ajax/libs/select2/4.0.6-rc.0/css/select2.min.css');

        var baseUrl = 'https://supercoolweather.firebaseapp.com/';
        var citySelector = $('#selectCityToAdd');
        citySelector.select2({
          placeholder: 'Type to search',
          minimumInputLength: 1,
          ajax: {
            delay: 250,
            url: function (params) {
              return baseUrl + 'cities/' + params.term;
            },
            data: function (params) {
              return null;
            },
            processResults: function (data) {
              return {
                results: data.map(function (c) {
                  return { id: c, text: c};
                })
              };
            }
          }
        })
        .on('change', function(){
          if (citySelector.select2('data').length) {
            app.addButton.removeAttribute('disabled');
          } else {
            app.addButton.setAttribute('disabled', '');
          }
        });
      });
    });
  }

  if (navigator.geolocation) {
    document.querySelector('.dialog-body-location')
      .removeAttribute('hidden');
  }

  function getGeoLocation(timeout) {
    return new Promise(function(resolve, reject) {
      var geoOptions = { timeout: timeout };

      var geoSuccess = function(position) {
        resolve(position.coords);
      };

      var geoError = function(error) {
        reject(error);
      };

      navigator.geolocation.getCurrentPosition(
        geoSuccess, geoError, geoOptions);
    });
  }

  function getAddresses(coords) {
    var url = 'https://maps.googleapis.com/maps/api/geocode/json?'
      + 'latlng=' + coords.latitude + ',' + coords.longitude
      + '&key=AIzaSyBFZ6FcacXwwCTzBwPkoOe7T99Jbaw8JNA';

    return new Promise(function(resolve, reject) {
      var request = new XMLHttpRequest();
      request.onreadystatechange = function() {
        if (request.readyState === XMLHttpRequest.DONE) {
          if (request.status === 200) {
            resolve(JSON.parse(request.response).results);
          } else {
            reject(request.response);
          }
        }
      };
      request.open('GET', url);
      request.send();
    });
  }

  function getCityName(addresses) {
    var address = addresses.find(function(c) { 
      return c.types[0] === 'locality';
    });

    if (address) {
      var city = address.address_components
        .find(function(c) {
          return c.types[0] === 'locality';
        });
      var state = address.address_components
        .find(function(c) {
          return c.types[0] === 'administrative_area_level_1';
        });

      if (city && state) {
        return city.short_name + ', ' + state.short_name;
      }
    }

    throw new Error('Can not parse current address.');
  }

  function getUserLocation() {
    return getGeoLocation(10 * 1000)
      .then(function(coords) {
        app.toggleDialogNudge(false);
        return getAddresses(coords);
      })
      .then(getCityName)
      .catch(function(error) {
        console.log('Error occurred. Error: ' + error);
        switch(error.code) {
          case error.TIMEOUT:
            // The user didn't accept the callout
            app.toggleDialogNudge(true);
            break;
        }
      });
  }

  window.onload = function () {
    prepareCitySelection();
  };
})();
