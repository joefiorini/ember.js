/**
@module ember
@submodule ember-routing
*/

var get = Ember.get, set = Ember.set,
    map = Ember.EnumerableUtils.map;

var queuedQueryParamChanges = {};

Ember.ControllerMixin.reopen({
  /**
    Transition the application into another route. The route may
    be either a single route or route path:

    ```javascript
    aController.transitionToRoute('blogPosts');
    aController.transitionToRoute('blogPosts.recentEntries');
    ```

    Optionally supply a model for the route in question. The model
    will be serialized into the URL using the `serialize` hook of
    the route:

    ```javascript
    aController.transitionToRoute('blogPost', aPost);
    ```

    If a literal is passed (such as a number or a string), it will
    be treated as an identifier instead. In this case, the `model`
    hook of the route will be triggered:

    ```javascript
    aController.transitionToRoute('blogPost', 1);
    ```

    Multiple models will be applied last to first recursively up the
    resource tree.

    ```javascript
    App.Router.map(function() {
      this.resource('blogPost', {path:':blogPostId'}, function(){
        this.resource('blogComment', {path: ':blogCommentId'});
      });
    });
    
    aController.transitionToRoute('blogComment', aPost, aComment);
    aController.transitionToRoute('blogComment', 1, 13);
    ```

    It is also possible to pass a URL (a string that starts with a
    `/`). This is intended for testing and debugging purposes and
    should rarely be used in production code.

    ```javascript
    aController.transitionToRoute('/');
    aController.transitionToRoute('/blog/post/1/comment/13');
    ```

    See also [replaceRoute](/api/classes/Ember.ControllerMixin.html#method_replaceRoute).

    @param {String} name the name of the route or a URL
    @param {...Object} models the model(s) or identifier(s) to be used
    while transitioning to the route.
    @for Ember.ControllerMixin
    @method transitionToRoute
  */
  transitionToRoute: function() {
    // target may be either another controller or a router
    var target = get(this, 'target'),
        method = target.transitionToRoute || target.transitionTo;
    return method.apply(target, arguments);
  },

  /**
    @deprecated
    @for Ember.ControllerMixin
    @method transitionTo
  */
  transitionTo: function() {
    Ember.deprecate("transitionTo is deprecated. Please use transitionToRoute.");
    return this.transitionToRoute.apply(this, arguments);
  },

  /**
    Transition into another route while replacing the current URL, if possible.
    This will replace the current history entry instead of adding a new one.
    Beside that, it is identical to `transitionToRoute` in all other respects.

    ```javascript
    aController.replaceRoute('blogPosts');
    aController.replaceRoute('blogPosts.recentEntries');
    ```

    Optionally supply a model for the route in question. The model
    will be serialized into the URL using the `serialize` hook of
    the route:

    ```javascript
    aController.replaceRoute('blogPost', aPost);
    ```

    If a literal is passed (such as a number or a string), it will
    be treated as an identifier instead. In this case, the `model`
    hook of the route will be triggered:

    ```javascript
    aController.replaceRoute('blogPost', 1);
    ```

    Multiple models will be applied last to first recursively up the
    resource tree.

    ```javascript
    App.Router.map(function() {
      this.resource('blogPost', {path:':blogPostId'}, function(){
        this.resource('blogComment', {path: ':blogCommentId'});
      });
    });
    
    aController.replaceRoute('blogComment', aPost, aComment);
    aController.replaceRoute('blogComment', 1, 13);
    ```

    It is also possible to pass a URL (a string that starts with a
    `/`). This is intended for testing and debugging purposes and
    should rarely be used in production code.

    ```javascript
    aController.replaceRoute('/');
    aController.replaceRoute('/blog/post/1/comment/13');
    ```

    @param {String} name the name of the route or a URL
    @param {...Object} models the model(s) or identifier(s) to be used
    while transitioning to the route.
    @for Ember.ControllerMixin
    @method replaceRoute
  */
  replaceRoute: function() {
    // target may be either another controller or a router
    var target = get(this, 'target'),
        method = target.replaceRoute || target.replaceWith;
    return method.apply(target, arguments);
  },

  /**
    @deprecated
    @for Ember.ControllerMixin
    @method replaceWith
  */
  replaceWith: function() {
    Ember.deprecate("replaceWith is deprecated. Please use replaceRoute.");
    return this.replaceRoute.apply(this, arguments);
  }
});

if (Ember.FEATURES.isEnabled("query-params-new")) {
  Ember.ControllerMixin.reopen({

    concatenatedProperties: ['queryParams'],

    queryParams: null,

    _queryParamScope: null,

    _finalizingQueryParams: false,
    _queryParamHash: Ember.computed(function computeQueryParamHash() {

      // Given: queryParams: ['foo', 'bar:baz'] on controller:thing
      // _queryParamHash should yield: { 'foo': 'thing[foo]' }

      var result = {};
      var queryParams = this.queryParams;
      if (!queryParams) {
        return result;
      }

      for (var i = 0, len = queryParams.length; i < len; ++i) {
        var full = queryParams[i];
        var parts = full.split(':');
        var key = parts[0];
        var urlKey = parts[1];
        if (!urlKey) {
          if (this._queryParamScope) {
            urlKey = this._queryParamScope + '[' + key + ']';
          } else {
            urlKey = key;
          }
        }
        result[key] = urlKey;
      }

      return result;
    }),

    _activateQueryParamObservers: function() {
      var queryParams = get(this, '_queryParamHash');

      for (var k in queryParams) {
        if (queryParams.hasOwnProperty(k)) {
          this.addObserver(k, this, this._queryParamChanged);
          this.addObserver(k + '.[]', this, this._queryParamChanged);
        }
      }
    },

    _deactivateQueryParamObservers: function() {
      var queryParams = get(this, '_queryParamHash');

      for (var k in queryParams) {
        if (queryParams.hasOwnProperty(k)) {
          this.removeObserver(k, this, this._queryParamChanged);
          this.removeObserver(k + '.[]', this, this._queryParamChanged);
        }
      }
    },

    _queryParamChanged: function(controller, key) {
      // Normalize array observer firings.
      if (key.slice(key.length - 3) === '.[]') {
        key = key.substr(0, key.length-3);
      }

      if (this._finalizingQueryParams) {
        var changes = this._queryParamChangesDuringSuspension;
        if (changes) {
          changes[key] = true;
        }
        return;
      }

      var queryParams = get(this, '_queryParamHash');
      queuedQueryParamChanges[queryParams[key]] = Ember.copy(get(this, key));
      Ember.run.once(this, this._fireQueryParamTransition);
    },

    _fireQueryParamTransition: function() {
      this.transitionToRoute({ queryParams: queuedQueryParamChanges });
      queuedQueryParamChanges = {};
    },

    _queryParamChangesDuringSuspension: null
  });
}
