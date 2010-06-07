var Spaz; if (!Spaz){ Spaz = {}; }

if (!Spaz.Timelines){ Spaz.Timelines = {}; }


/**
 * The string prefix for a "not these" filter
 */
var NEGATION_TOKEN = "not:";

/**
 * The AppTimeline is defined here so we can inherit its prototype below 
 */
var AppTimeline = function() {};


AppTimeline.prototype.model = {
	'items' : []
};

/**
 * This is just a wrapper to start the SpazTimeline object contained within 
 */
AppTimeline.prototype.activate = function() {
	this.timeline.start();
};

/**
 * filter the timeline (hide or show entries) based on a string of terms
 * @param {string} terms 
 */
AppTimeline.prototype.filter = function(terms) {
	var entry_selector = this.getEntrySelector();
	sch.dump(entry_selector);
	var jqentries = jQuery(entry_selector);
	jqentries.removeClass('hidden');

	if (terms) {
		try {
			var negate = false;
			if (terms.substring(0, NEGATION_TOKEN.length).toLowerCase() === NEGATION_TOKEN) {
				negate = true;
				terms  = terms.slice(NEGATION_TOKEN.length);
			}
			var filter_re = new RegExp(sch.trim(terms), "i");
			sch.dump(filter_re.toString());
			jqentries.each(function(i) {
				var jqthis = jQuery(this);
				if (negate) {
					if ( jqthis.text().search(filter_re) > -1 ) {
						jqthis.addClass('hidden');
					}
				} else {
					if ( jqthis.text().search(filter_re) === -1 ) {
						jqthis.addClass('hidden');
					}
				}
			});
		} catch(e) {
			sch.debug(e.name+":"+e.message);
		}
	}

};

AppTimeline.prototype.clear = function() {
	var entry_selector = this.getEntrySelector();
	$(entry_selector).remove();
};


AppTimeline.prototype.markAsRead = function() {
	var entry_selector = this.getEntrySelector();

	/* we use our own "mark as read" here because the helper version just removes the 'new' class' */
	$(entry_selector+':visible').removeClass('new').addClass('read').each(function(i){
		var status_id = $(this).attr('data-status-id');
		Spaz.DB.markEntryAsRead(status_id);
	});
	$().trigger('UNREAD_COUNT_CHANGED');

};

AppTimeline.prototype.getEntrySelector = function() {
	return this.getTimelineSelector() + ' ' + this.timeline.timeline_item_selector;
};

AppTimeline.prototype.getWrapperSelector = function() {
	return this.getTimelineSelector().replace('timeline-', 'timelinewrapper-');
};

AppTimeline.prototype.getTimelineSelector = function() {
	return this.timeline.timeline_container_selector;
};

AppTimeline.prototype.sortByAttribute = function(sortattr, idattr, sortfunc) {

	var itemSelector = this.getEntrySelector(),
		items        = jQuery(itemSelector),
		itemAttrs	 = [],
		itemsSorted  = [],
		sortedHTML	 = '';
	sortfunc = sortfunc || function(a,b){return b.sortval - a.sortval;};

	(function(){
		var i, iMax, $item, attrobj;
		for (i = 0, iMax = items.length; i < iMax; i++){
			$item = jQuery(items[i]);
			attrobj = {
				id:			$item.attr(idattr),
				sortval:	$item.attr(sortattr)
			};
			itemAttrs.push(attrobj);
		}
	})();

	itemAttrs.sort( sortfunc );

	(function(){
		var i, iMax, attrobj, selector, $item, itemHTML;
		for (i = 0, iMax = itemAttrs.length; i < iMax; i++){
			attrobj = itemAttrs[i];
			selector = itemSelector+"["+idattr+"=" + attrobj.id + "]";
			// sch.error(selector);
			$item = jQuery(selector);
			// sch.error($item.length);
			itemHTML = $item.get(0).outerHTML;
			// sch.error(itemHTML);
			itemsSorted.push(itemHTML);
		}
	})();
	
	sortedHTML = itemsSorted.join('');
	
	jQuery(this.getTimelineSelector()).html(sortedHTML);
};

AppTimeline.prototype.refresh = function() {
	sch.error('refreshing timeline');
	this.timeline.refresh();
};


/**
 * Friends timeline def 
 */
var FriendsTimeline = function() {

	var thisFT			 = this,
		$timeline		 = $('#timeline-friends'),
		$timelineWrapper = $timeline.parent();
	this.twit  = new SpazTwit();

	this.pager = {
		'home_count':    Spaz.Prefs.get('timeline-home-pager-count'),
		'dm_count':      Spaz.Prefs.get('timeline-direct-pager-count'),
		'replies_count': Spaz.Prefs.get('timeline-replies-pager-count'),
		'next_opts': null,
		'back_opts': null
	};

	this.pager.getNextOpts = function() {
		if (null === this.next_opts) {
			return {
				'home_count':    this.home_count,
				'dm_count':      this.dm_count,
				'replies_count': this.replies_count
			};
		}
		this.back_opts = this.next_opts;
		this.next_opts = null;
		return this.back_opts;
	};

	this.pager.changeCount = function(section, value) {

		if (thisFT.twit.data[SPAZCORE_SECTION_COMBINED].items.length) {

			var name = (section === 'dms' ? 'dm' : section),
				opts = this.getNextOpts();

			if (value > opts[name + '_count']) {
				opts[name + '_count']  = value - opts[name + '_count'];

				opts[name + '_since']  = 1 - jQuery(
					thisFT.getEntrySelector() +
					(name === 'home'    ? ':not(.dm):not(.reply)' :
					(name === 'dm'      ? '.dm' :
					(name === 'replies' ? '.reply' : ''))))
					.slice(-1).attr('data-status-id');
				
				opts[name + '_lastid'] = thisFT.twit.data[section].lastid;
				thisFT.twit.data[section].max = opts[name + '_count'];
			}
			this[name + '_count'] = value;
			thisFT.twit.data[SPAZCORE_SECTION_COMBINED].max = (this.home_count + this.dm_count + this.replies_count);

			this.next_opts = opts;
			this.back_opts = null;
		}
	};

	this.pager.cleanUp = function() {

		if (null === this.back_opts) {
			return;
		}
		var dataTW = thisFT.twit.data,
			back   = this.back_opts;

		if (back.home_lastid) {
			dataTW[SPAZCORE_SECTION_HOME].lastid = back.home_lastid;
		}
		if (back.dm_lastid) {
			dataTW[SPAZCORE_SECTION_DMS].lastid = back.dm_lastid;
		}
		if (back.replies_lastid) {
			dataTW[SPAZCORE_SECTION_REPLIES].lastid = back.replies_lastid;
		}
		dataTW[SPAZCORE_SECTION_HOME].max     = this.home_count;
		dataTW[SPAZCORE_SECTION_DMS].max      = this.dm_count;
		dataTW[SPAZCORE_SECTION_REPLIES].max  = this.replies_count;
		dataTW[SPAZCORE_SECTION_COMBINED].max = (this.home_count + this.dm_count + this.replies_count);
		this.back_opts = null;
		thisFT.sortByAttribute('data-timestamp', 'data-status-id');
	};


	/*
		set up the Friends timeline
	*/
	this.timeline  = new SpazTimeline({
		'timeline_container_selector' : $timeline.selector,
		'entry_relative_time_selector':'.status-created-at',
		
		'success_event':'new_combined_timeline_data',
		'failure_event':'error_combined_timeline_data',
		'event_target' :document,
		
		'refresh_time':Spaz.Prefs.get('network-refreshinterval'),
		'max_items': (this.pager.home_count + this.pager.dm_count + this.pager.replies_count),

		'request_data': function() {
			sch.dump('REQUESTING DATA FOR FRIENDS TIMELINE =====================');
			sch.markAllAsRead($timeline.selector + ' div.timeline-entry'); // just add .read to the entries
			var username = Spaz.Prefs.getUsername();
			var password = Spaz.Prefs.getPassword();

			var com_opts = thisFT.pager.getNextOpts();

			thisFT.twit.setCredentials(username, password);
			thisFT.twit.setBaseURLByService(Spaz.Prefs.getAccountType());
			thisFT.twit.getCombinedTimeline(com_opts);
			Spaz.UI.statusBar("Loading friends timeline");
			Spaz.UI.showLoading();
			
			sch.dump('REQUEST_DATA');
		},
		'data_success': function(e, data) {
			
			sch.dump('DATA_SUCCESS');
			
			data = data.reverse();
			sch.dump(data);
			
			/*
				Record old scroll position
			*/
			var $oldFirst = $timeline.find('div.timeline-entry:first'),
				offset_before;

			if ($oldFirst.length > 0) {
			    offset_before = $oldFirst.offset().top;
			}
				

			$timelineWrapper.children('.loading').hide();


			/**
				Prepare filter String of id's in form of :\d+:\d+:
				to test against in the renderer function
			 */
			var regexIDs = /.*?d(ata-status-id=.)(\d+)(?:.(?!\1)|\n)*|$/g;
			thisFT.filterIDs = $timeline.html().replace(regexIDs,':$2');
			
			
			/*
				Add new items
			*/
			thisFT.timeline.addItems(data);
			thisFT.pager.cleanUp();

            if (data.length) {
                sch.note('notify of new entries!');
                Spaz.UI.notifyOfNewEntries(data);
            }


			/*
				set new scroll position
			*/
			if (offset_before) {
			    var offset_after = $oldFirst.offset().top;
    			var offset_diff = Math.abs(offset_before - offset_after);
    			if ($timelineWrapper.scrollTop() > 0) {
    				$timelineWrapper.scrollTop( $timelineWrapper.scrollTop() + offset_diff );
    			}
			}

			/*
				reapply filtering
			*/
			$('#filter-friends').trigger('keyup');
			
			sch.updateRelativeTimes($timeline.selector + ' .status-created-at', 'data-created-at');
			
			/*
				get new set of usernames
			*/
			Spaz.Autocomplete.initSuggestions();
			
			Spaz.UI.hideLoading();
			Spaz.UI.statusBar("Ready");
			

		},
		'data_failure': function(e, error_obj) {
			sch.dump('DATA_FAILURE');
			var err_msg = "There was an error retrieving your timeline";
			Spaz.UI.statusBar(err_msg);

			/*
				Update relative dates
			*/
			sch.updateRelativeTimes($timeline.selector + ' a.status-created-at', 'data-created-at');
			Spaz.UI.hideLoading();
		},
		'renderer': function(obj) {
			if (RegExp(':' + obj.id + ':').test(thisFT.filterIDs)) {
				return '';
			}
			TweetModel.saveTweet(obj);
			obj.SC_is_read = !!Spaz.DB.isRead(obj.id);
			if (obj.SC_is_dm) {
				return Spaz.Tpl.parse('timeline_entry_dm', obj);
			} else {
				return Spaz.Tpl.parse('timeline_entry', obj);
			}
			
			
		}
	});
	
	/*
		override the default method
	*/
	this.timeline.removeExtraItems = function() {
		var sel = $timeline.selector;
		sch.removeExtraElements(sel + ' div.timeline-entry:not(.reply):not(.dm)', thisFT.pager.home_count);
		sch.removeExtraElements(sel + ' div.timeline-entry.reply', thisFT.pager.replies_count);
		sch.removeExtraElements(sel + ' div.timeline-entry.dm', thisFT.pager.dm_count);
	};
};

FriendsTimeline.prototype = new AppTimeline();

FriendsTimeline.prototype.reset = function() {
	sch.debug('reset friends timeline');

};







/**
 * Public timeline def 
 */
var PublicTimeline = function(args) {
	
	var thisPT			 = this,
		$timeline		 = $('#timeline-public'),
		$timelineWrapper = $timeline.parent();
	this.twit = new SpazTwit();
	
	/*
		set up the public timeline
	*/
	this.timeline  = new SpazTimeline({
		'timeline_container_selector' : $timeline.selector,
		'entry_relative_time_selector':'.status-created-at',
		
		'success_event':'new_public_timeline_data',
		'failure_event':'error_public_timeline_data',
		'event_target' :document,
		
		'refresh_time':1000*60*30, // 30 minutes
		'max_items':100,

		'request_data': function() {
			thisPT.markAsRead($timeline.selector + ' div.timeline-entry');
			thisPT.twit.setBaseURLByService(Spaz.Prefs.getAccountType());
			thisPT.twit.getPublicTimeline();
			Spaz.UI.statusBar("Loading public timeline");
			Spaz.UI.showLoading();
		},
		'data_success': function(e, data) {
			data = data.reverse();
			var i, iMax,
				no_dupes = [],
				dataItem; // "datum"?

			for (i = 0, iMax = data.length; i < iMax; i++){
				dataItem = data[i];

				/*
					only add if it doesn't already exist
				*/
				if ($timeline.find('div.timeline-entry[data-status-id='+dataItem.id+']').length<1) {

					no_dupes.push(dataItem);
					/*
						Save to DB via JazzRecord
					*/
					TweetModel.saveTweet(dataItem);
				}

			}

			$timelineWrapper.children('.loading').hide();
			thisPT.timeline.addItems(no_dupes);

			/*
				reapply filtering
			*/
			$('#filter-public').trigger('keyup');

			sch.markAllAsRead($timeline.selector + ' div.timeline-entry'); // public are never "new"
			sch.updateRelativeTimes($timeline.selector + ' a.status-created-at', 'data-created-at');

			Spaz.UI.hideLoading();
			Spaz.UI.statusBar("Ready");

		},
		'data_failure': function(e, error_obj) {
			var err_msg = "There was an error retrieving the public timeline";
			Spaz.UI.statusBar(err_msg);

			/*
				Update relative dates
			*/
			sch.updateRelativeTimes($timeline.selector + ' a.status-created-at', 'data-created-at');
			Spaz.UI.hideLoading();
		},
		'renderer': function(obj) {
			return Spaz.Tpl.parse('timeline_entry', obj);

		}
	});




};

PublicTimeline.prototype = new AppTimeline();





/**
 * Public timeline def 
 */
var FavoritesTimeline = function(args) {

	var thisFVT			 = this,
		$timeline		 = $('#timeline-favorites'),
		$timelineWrapper = $timeline.parent();
	this.twit = new SpazTwit();

	/*
		set up the public timeline
	*/
	this.timeline  = new SpazTimeline({
		'timeline_container_selector' : $timeline.selector,
		'entry_relative_time_selector':'.status-created-at',

		'success_event':'new_favorites_timeline_data',
		'failure_event':'error_favorites_timeline_data',
		'event_target' :document,

		'refresh_time':1000*60*30, // 30 minutes
		'max_items':100,

		'request_data': function() {
			thisFVT.markAsRead($timeline.selector + ' div.timeline-entry');
			var username = Spaz.Prefs.getUsername();
			var password = Spaz.Prefs.getPassword();
			thisFVT.twit.setCredentials(username, password);
			thisFVT.twit.setBaseURLByService(Spaz.Prefs.getAccountType());
			thisFVT.twit.getFavorites();
			Spaz.UI.statusBar("Loading favorites timeline");
			Spaz.UI.showLoading();
		},
		'data_success': function(e, data) {
			data = data.reverse();
			var i, iMax,
				no_dupes = [],
				dataItem;

			for (i = 0, iMax = data.length; i < iMax; i++){
				dataItem = data[i];

				/*
					only add if it doesn't already exist
				*/
				if ($timeline.find('div.timeline-entry[data-status-id='+dataItem.id+']').length<1) {

					no_dupes.push(dataItem);
					/*
						Save to DB via JazzRecord
					*/
					TweetModel.saveTweet(dataItem);
				}

			}

			$timelineWrapper.children('.loading').hide();
			thisFVT.timeline.addItems(no_dupes);

			/*
				reapply filtering
			*/
			$('#filter-favorites').trigger('keyup');


			sch.markAllAsRead($timeline.selector + ' div.timeline-entry'); // favorites are never "new"
			sch.updateRelativeTimes($timeline.selector + ' a.status-created-at', 'data-created-at');

			Spaz.UI.hideLoading();
			Spaz.UI.statusBar("Ready");

		},
		'data_failure': function(e, error_obj) {
			var err_msg = "There was an error retrieving the favorites timeline";
			Spaz.UI.statusBar(err_msg);

			/*
				Update relative dates
			*/
			sch.updateRelativeTimes($timeline.selector + ' a.status-created-at', 'data-created-at');
			Spaz.UI.hideLoading();
		},
		'renderer': function(obj) {
			return Spaz.Tpl.parse('timeline_entry', obj);
		}
	});
};

FavoritesTimeline.prototype = new AppTimeline();





/**
 * User timeline def 
 */
var UserTimeline = function(args) {

	var thisUT			 = this,
		$timeline		 = $('#timeline-user'),
		$timelineWrapper = $timeline.parent();
	this.twit = new SpazTwit();

	var maxUT = Spaz.Prefs.get('timeline-user-pager-count-max');

	/*
		set up the user timeline
	*/
	this.timeline  = new SpazTimeline({
		'timeline_container_selector' : $timeline.selector,
		'entry_relative_time_selector':'.status-created-at',
		
		'success_event':'new_user_timeline_data',
		'failure_event':'error_user_timeline_data',
		'event_target' :document,
		
		'refresh_time':1000*60*30, // 30 minutes
		'max_items': maxUT,

		'request_data': function() {
			thisUT.markAsRead($timeline.selector + ' div.timeline-entry');
			var username = Spaz.Prefs.getUsername();
			var password = Spaz.Prefs.getPassword();

			var countmax = thisUT.timeline.max_items;
			var count = Spaz.Prefs.get('timeline-user-pager-count');
			count = (count > maxUT ? maxUT : count);

			thisUT.twit.setCredentials(username, password);
			thisUT.twit.getUserTimeline(username, count);
			Spaz.UI.statusBar("Loading user timeline");
			Spaz.UI.showLoading();
		},
		'data_success': function(e, data) {
			data = data.reverse();
			var i, iMax,
				no_dupes = [],
				dataItem;
			
			for (i = 0, iMax = data.length; i < iMax; i++){
				dataItem = data[i];
				
				/*
					only add if it doesn't already exist
				*/
				if ($timeline.find('div.timeline-entry[data-status-id='+dataItem.id+']').length<1) {
					
					no_dupes.push(dataItem);
					/*
						Save to DB via JazzRecord
					*/
					TweetModel.saveTweet(dataItem);
				}
				
			}

			$timelineWrapper.children('.loading').hide();
			thisUT.timeline.addItems(no_dupes);

			/*
			 reapply filtering
			*/
			$('#filter-user').trigger('keyup');


			sch.markAllAsRead($timeline.selector + ' div.timeline-entry'); // user is never "new"
			sch.updateRelativeTimes($timeline.selector + ' a.status-created-at', 'data-created-at');

			Spaz.UI.hideLoading();
			Spaz.UI.statusBar("Ready");
			
		},
		'data_failure': function(e, error_obj) {
			var err_msg = "There was an error retrieving the user timeline";
			Spaz.UI.statusBar(err_msg);

			/*
				Update relative dates
			*/
			sch.updateRelativeTimes($timeline.selector + ' a.status-created-at', 'data-created-at');
			Spaz.UI.hideLoading();
		},
		'renderer': function(obj) {
			return Spaz.Tpl.parse('timeline_entry', obj);
			
		}
	});
	
	
	
};

UserTimeline.prototype = new AppTimeline();





/**
 * User timeline def 
 */
var UserlistsTimeline = function(args) {

	var thisULT			 = this,
		$timeline		 = $('#timeline-userlists'),
		$timelineWrapper = $timeline.parent();
	
	this.twit = new SpazTwit();
	
	this.list = {
		'user':null,
		'slug':null
	};
	
	/**
	 * @param {string} slug the list slug
	 * @param {string} user the user who owns the list 
	 */
	this.setlist = function(slug, user) {
		if (slug != this.list.slug || user != this.list.user) {
			$(this.timeline.timeline_container_selector).empty();
		}
		
		this.list.user = user;
		this.list.slug = slug;
		
		
		
		this.timeline.start();
	};
	
	/*
		set up the userlists timeline
	*/
	this.timeline  = new SpazTimeline({
		'timeline_container_selector' : $timeline.selector,
		'entry_relative_time_selector':'.status-created-at',
		
		'success_event':'get_list_timeline_succeeded',
		'failure_event':'get_list_timeline_failed',
		'event_target' :document,
		
		'refresh_time':1000*60*5, // 30 minutes
		'max_items':300,

		'request_data': function() {

			thisULT.markAsRead($timeline.selector + ' div.timeline-entry');
						
			if (thisULT.list.user && thisULT.list.slug) {
				// Give UI feedback immediately
				$('#timeline-userlists-full-name').text("@"+thisULT.list.user+'/'+thisULT.list.slug);
				if($timeline.is(':empty')){
					$timelineWrapper.children('.loading').show();
				}
				$timelineWrapper.children('.intro').hide();

				var username = Spaz.Prefs.getUsername(),
					password = Spaz.Prefs.getPassword();
				thisULT.twit.setCredentials(username, password);
				thisULT.twit.setBaseURLByService(Spaz.Prefs.getAccountType());
				thisULT.twit.getListTimeline(thisULT.list.slug, thisULT.list.user);
				Spaz.UI.statusBar("Getting list @"+thisULT.list.user+'/'+thisULT.list.slug + "…");
				Spaz.UI.showLoading();
			}
			
			
		},
		'data_success': function(e, data) {
			
			sch.debug('statuses:'+data.statuses);
			sch.debug('user:'+data.user);
			sch.debug('slug:'+data.slug);
			
			// data.statuses = data.statuses.reverse();
			var no_dupes = [];
			
			var status;
			
			for (var i = 0, iMax = data.statuses.length; i < iMax; i++) {
				status = data.statuses[i];
				
				/*
					only add if it doesn't already exist
				*/
				if ($timeline.find('div.timeline-entry[data-status-id='+status.id+']').length<1) {
					sch.debug('div.timeline-entry[data-status-id='+status.id+'] does not exist… adding');
					
					no_dupes.push(status);
					/*
						Save to DB via JazzRecord
					*/
					TweetModel.saveTweet(status);
				} else {
					sch.debug(status.id+' already exists');
				}
				
			}

			$timelineWrapper.children('.loading, .intro').hide();
			thisULT.timeline.addItems(no_dupes);

			/*
			 reapply filtering
			*/
			$('#filter-userlists').trigger('keyup');
			
			
			sch.markAllAsRead($timeline.selector + ' div.timeline-entry'); // user is never "new"
			sch.updateRelativeTimes($timeline.selector + ' a.status-created-at', 'data-created-at');
			
			Spaz.UI.hideLoading();
			Spaz.UI.statusBar("Ready");
			
		},
		'data_failure': function(e, error_obj) {
			var err_msg = "There was an error retrieving the userlists timeline";
			Spaz.UI.statusBar(err_msg);
			
			/*
				Update relative dates
			*/
			sch.updateRelativeTimes($timeline.selector + ' a.status-created-at', 'data-created-at');
			Spaz.UI.hideLoading();
		},
		'renderer': function(obj) {
			return Spaz.Tpl.parse('timeline_entry', obj);
			
		}
	});
	
	
	
	this.buildListsMenu = function() {
		var username = Spaz.Prefs.getUsername();
		var password = Spaz.Prefs.getPassword();
		thisULT.twit.setCredentials(username, password);
		thisULT.twit.setBaseURLByService(Spaz.Prefs.getAccountType());
		sch.debug("Loading lists for @"+username+ "…");
		Spaz.UI.statusBar("Loading lists for @"+username+ "…");
		Spaz.UI.showLoading();
		
		
		
		thisULT.twit.getLists(username, function(data) {
			/*
				build a new menu
			*/
			var i, iMax,
				root_container_selector = '#container',
				menu_id = 'lists-menu',
				menu_class = 'popup-menu',
				menu_items = [],
				menu_item_class = 'userlists-menu-item',
				menu_trigger_selector = '#view-userlists';
			
			// if it exists, remove
			$('#'+menu_id).remove();
			
			for (i = 0, iMax = data.lists.length; i < iMax; i++){
				var thislist = data.lists[i];
				menu_items[i] = {
					'label':thislist.full_name,
					'id':'userlist-'+thislist.user.screen_name+'-'+thislist.slug, // this should be unique!
					'attributes':{
						'data-list-id':thislist.id,
						'data-list-name':thislist.name,
						'data-list-slug':thislist.slug,
						'data-user-screen_name':thislist.user.screen_name,
						'title':thislist.description
					},
					'onclick':function(e) {
						var $this = $(this),
							slug  = $this.attr('data-list-slug'),
							user  = $this.attr('data-user-screen_name');
						thisULT.setlist(slug, user);
					}
				};
			}
		
			
			/*
				create container for menu
			*/
			$(root_container_selector).append('<ul id="'+menu_id+'" class="'+menu_class+'"></ul>');
			var $menu = $('#' + menu_id);
			
			/*
				add <li> items to menu
			*/
			for (i = 0, iMax = menu_items.length; i < iMax; i++){

				var menuItem = menu_items[i],
					menuItemAttributes = menuItem.attributes,
					jqitem = $('<li id="'+menuItem.id+'" class="menuitem '+menu_item_class+'">'+menuItem.label+'</li>');

				for (var key in menuItemAttributes) {
					if(menuItemAttributes.hasOwnProperty(key)){
						jqitem.attr(key, menuItemAttributes[key]);
					}
				}

				$menu.append(jqitem);
				
				/*
					if onclick is defined for this item, bind it to the ID of this element
				*/
				if (menuItem.onclick) {
					sch.debug(menuItem.id);
					sch.debug(menuItem.onclick);
					
					$('#'+menuItem.id).bind('click', {'onClick':menuItem.onclick}, function(e) {
						e.data.onClick.call(this, e); // 'this' refers to the clicked element
					});
				}
			}
			
			sch.debug($menu.get(0).innerHTML);
			
			/*
				show menu on event
			*/
			$(menu_trigger_selector).live('click', function(e) {
				/*
					thank you http://stackoverflow.com/questions/158070/jquery-how-to-position-one-element-relative-to-another
				*/
				var $this	= $(this),
					pos		= $this.offset(),
					height	= $this.height(),
					width	= $this.width();
				$menu.css({
					position: 'absolute',
					left:	  pos.left + 'px',
					top:	  (pos.top + height) + 'px'
				}).show();
				
				$(document).one('click', function() {
					$menu.hide();
				});
			});
			
			Spaz.UI.statusBar("Lists loaded for @"+username+ "…");
			Spaz.UI.hideLoading();
			
		}, function(msg) {
			Spaz.UI.statusBar("Loading lists for @"+username+ " failed!");
			Spaz.UI.hideLoading();
			
		});
		
		
	};

	/*
		build the lists menu
	*/
	thisULT.buildListsMenu();
};

UserlistsTimeline.prototype = new AppTimeline();




/**
 * Search timeline def 
 */
var SearchTimeline = function(args) {

	var thisST			 = this,
		$timeline		 = $('#timeline-search'),
		$timelineWrapper = $timeline.parent();
	
	this.query = null;
	this.lastquery = null;
	
	this.twit = new SpazTwit();
	
	var maxST = Spaz.Prefs.get('timeline-search-pager-count-max');
	/*
		set up the public timeline
	*/
	this.timeline  = new SpazTimeline({
		'timeline_container_selector' : $timeline.selector,
		'entry_relative_time_selector':'.status-created-at',
		
		'success_event':'new_search_timeline_data',
		'failure_event':'error_search_timeline_data',
		
		'event_target' :document,
		
		
		'refresh_time':1000*60*15, // 15 minutes
		'max_items': maxST,

		'request_data': function() {
			var $searchInput = jQuery('#search-for');
			var count = Spaz.Prefs.get('timeline-search-pager-count');
			count = (count > maxST ? maxST : count);

			if ($searchInput.val().length > 0) {
				thisST.query = $searchInput.val();

				// Give UI feedback immediately
				Spaz.UI.statusBar("Searching for '" + thisST.query + "'…");
				Spaz.UI.showLoading();
				if($timeline.is(':empty')){
					$timelineWrapper.children('.loading').show();
				}
				$timelineWrapper.children('.intro, .empty').hide();

				if (!thisST.lastquery) {
					thisST.lastquery = thisST.query;
				} else if (thisST.lastquery != thisST.query) {
					$timeline.find('.timeline-entry').remove();
				}
				
				// alert(thisST.lastquery+"\n"+thisST.query);
				
				// clear the existing results if this is a new query
				thisST.markAsRead($timeline.selector + ' div.timeline-entry');
				
				thisST.twit.setBaseURLByService(Spaz.Prefs.getAccountType());
				thisST.twit.search(thisST.query, null, count);
				thisST.lastquery = thisST.query;
			}
		},
		'data_success': function(e, data) {
			sch.dump(e);
			var query_info = data[1];
			data = data[0] || [];
			
			data = data.reverse();
			var i, iMax,
				no_dupes = [],
				md = new Showdown.converter(),
				dataItem;
			
			for (i = 0, iMax = data.length; i < iMax; i++){
				dataItem = data[i];
				
				/*
					only add if it doesn't already exist
				*/
				if ($timeline.find('div.timeline-entry[data-status-id='+dataItem.id+']').length<1) {
					// if (Spaz.Prefs.get('usemarkdown')) {
					//	dataItem.text = md.makeHtml(dataItem.text);
					//	dataItem.text = dataItem.text.replace(/href="([^"]+)"/gi, 'href="$1" title="Open link in a browser window" class="inline-link"');
					// }
					
					no_dupes.push(dataItem);
					
					/*
						Save to DB via JazzRecord
					*/
					TweetModel.saveTweet(dataItem);
				}
				
			}
			
			$timelineWrapper.children('.loading, .intro').hide();
			$timelineWrapper.children('.empty').toggle(no_dupes.length === 0);
			if (no_dupes.length > 0) {
				thisST.timeline.addItems(no_dupes);
			}

			sch.markAllAsRead($timeline.selector + ' div.timeline-entry'); // search are never "new"
			sch.updateRelativeTimes($timeline.selector + ' a.status-created-at', 'data-created-at');

			Spaz.UI.hideLoading();
			Spaz.UI.statusBar("Ready");
		},
		'data_failure': function(e, error_obj) {
			var err_msg = "There was an error retrieving your favorites";
			Spaz.UI.statusBar(err_msg);

			/*
				Update relative dates
			*/
			sch.updateRelativeTimes($timeline.selector + ' a.status-created-at', 'data-created-at');
			Spaz.UI.hideLoading();
		},
		'renderer': function(obj) {
			
			var html = Spaz.Tpl.parse('timeline_entry', obj);
			return html;
			
		}
	});
};

SearchTimeline.prototype = new AppTimeline();




/**
 * Followers/following timeline def 
 */
var FollowersTimeline = function(args) {

	var thisFLT			 = this,
		$timeline		 = $('#timeline-followerslist'),
		$timelineWrapper = $timeline.parent();
	this.twit = new SpazTwit();
	
	/*
		set up the user timeline
	*/
	this.timeline  = new SpazTimeline({
		'timeline_container_selector' : $timeline.selector,
		'entry_relative_time_selector':'.status-created-at',
		
		'success_event':'get_followerslist_succeeded',
		'failure_event':'get_followerslist_failed',
		'event_target' :document,
		
		'refresh_time':-1, // never automatically
		'max_items':200,

		'request_data': function() {
			sch.markAsRead($timeline.selector + ' div.timeline-entry');
			var username = Spaz.Prefs.getUsername();
			var password = Spaz.Prefs.getPassword();
			thisFLT.twit.setCredentials(username, password);
			thisFLT.twit.setBaseURLByService(Spaz.Prefs.getAccountType());
			thisFLT.twit.getFollowersList();
			Spaz.UI.statusBar("Loading followerslist");
			Spaz.UI.showLoading();
		},
		'data_success': function(e, data) {
			// alert('got follower data');
			data = data.reverse();
			
			var i, iMax,
				no_dupes = [],
				dataItem;
			
			for (i = 0, iMax = data.length; i < iMax; i++){
				dataItem = data[i];
				
				/*
					only add if it doesn't already exist
				*/
				if ($timeline.find('div.timeline-entry[data-status-id='+dataItem.id+']').length<1) {
					
					no_dupes.push(dataItem);
					/*
						Save to DB via JazzRecord
					*/
					TwUserModel.findOrCreate(dataItem);
				}
				
			}

			$timelineWrapper.children('.loading').hide();
			thisFLT.timeline.addItems(no_dupes);

			Spaz.UI.hideLoading();
			Spaz.UI.statusBar("Ready");
			
		},
		'data_failure': function(e, error_obj) {
			var err_msg = "There was an error retrieving the user timeline";
			Spaz.UI.statusBar(err_msg);

			/*
				Update relative dates
			*/
			sch.updateRelativeTimes($timeline.selector + ' a.status-created-at', 'data-created-at');
			Spaz.UI.hideLoading();
		},
		'renderer': function(obj) {
			return Spaz.Tpl.parse('followerslist_row', obj);
			
		}
	});
	
};

FollowersTimeline.prototype = new AppTimeline();


/**
 * Initialize the timelines 
 */
Spaz.Timelines.init = function() {
	Spaz.Timelines.friends	 = new FriendsTimeline();
	Spaz.Timelines.user		 = new UserTimeline();
	Spaz.Timelines['public'] = new PublicTimeline();
		// `public` is a reserved keyword
	Spaz.Timelines.favorites = new FavoritesTimeline();
	Spaz.Timelines.userlists = new UserlistsTimeline();
	Spaz.Timelines.search	 = new SearchTimeline();
	Spaz.Timelines.followers = new FollowersTimeline();
	
	Spaz.Timelines.map = {
		friends:	Spaz.Timelines.friends,
		user:		Spaz.Timelines.user,
		'public':	Spaz.Timelines['public'],
		userlists:	Spaz.Timelines.userlists,
		favorites:	Spaz.Timelines.favorites,
		search:		Spaz.Timelines.search//,
		// followerslist: Spaz.Timelines.followerslist
	};


};

Spaz.Timelines.getTimelineFromTab = function(tab) {
	var timeline = tab.id.replace(/tab-/, '');
	sch.debug('timeline for tab:' + timeline);
	return Spaz.Timelines.map[timeline];
};

Spaz.Timelines.getTabFromTimeline = function(tab) {
	var timeline = tab.id.replace(/tab-/, '');
	sch.debug('timeline for tab:' + timeline);
	return Spaz.Timelines.map[timeline];
};


Spaz.Timelines.resetTimelines = function() {
	/*
		remove all timeline event listeners
	*/
	var timelinesMap = Spaz.Timelines.map;

	if (typeof timelinesMap !== 'undefined') {
		for (var key in timelinesMap) {
			if(timelinesMap.hasOwnProperty(key)){
				sch.error(key);
				timelinesMap[key].timeline.stopListening();
			}
		}
	}

	Spaz.Timelines.init();


	/*
		clear timeline entries inside the timelines
	*/
	$('div.timeline-entry').remove();

};

