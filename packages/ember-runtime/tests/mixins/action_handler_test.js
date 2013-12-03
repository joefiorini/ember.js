test("passing a function for the actions hash triggers an assertion", function() {
  expect(1);

  var controller = Ember.Controller.extend({
    actions: function(){}
  });

  expectAssertion(function(){
    Ember.run(function(){
      controller.create();
    });
  });
});

module("passing an object for the action", {
  setup: function() {
  }
});

test("calls before callback if supplied", function() {
  var beforeCalled = false;

  var target = Ember.Controller.extend({
    actions: {
      show: {
        before: function() {
          beforeCalled = true;
        },
        action: function() {
        }
      }
    }
  }).create();

  target.send("show");

  ok(beforeCalled, "should call before callback");
});

test("calls action callback as action", function() {
  var actionCalled = false;

  var target = Ember.Controller.extend({
    actions: {
      show: {
        action: function() {
          actionCalled = true;
        }
      }
    }
  }).create();

  target.send("show");

  ok(actionCalled, "should call before callback");
});

test("calls after callback if supplied", function() {
  var afterCalled = false;

  var target = Ember.Controller.extend({
    actions: {
      show: {
        action: function() { },
        after: function() {
          afterCalled = true;
        }
      }
    }
  }).create();

  target.send("show");

  ok(afterCalled, "should call before callback");
});

test("promise action - delays action until before resolves", function() {
  var promise, resolver,
      beforeCalled = false,
      actionCalled = false;

  var target = Ember.Controller.extend({
    actions: {
      show: {
        before: function() {
          promise = new Ember.RSVP.Promise(function(resolve, reject) {
            resolver = resolve;
          });
          beforeCalled = true;
          return promise;
        },
        action: function() {
          actionCalled = true;
        }
      }
    }
  }).create();

  target.send("show");
  ok(beforeCalled && !actionCalled, "action should wait until before promise resolves");

  Ember.run(function() {
    resolver();
  });

  ok(actionCalled, "action should be called after promise resolves");

});

test("promise action - delays after until action resolves", function() {
  var promise, resolver,
      afterCalled = false,
      actionCalled = false;

  var target = Ember.Controller.extend({
    actions: {
      show: {
        after: function() {
          afterCalled = true;
        },
        action: function() {
          promise = new Ember.RSVP.Promise(function(resolve, reject) {
            resolver = resolve;
          });
          actionCalled = true;
          return promise;
        }
      }
    }
  }).create();

  target.send("show");
  ok(actionCalled && !afterCalled, "after should wait until action promise resolves");

  Ember.run(function() {
    resolver();
  });

  ok(actionCalled, "after should be called after promise resolves");

});
