const StorageProvider = require('./StorageProvider');
const FirebaseStorageProvider = require('./FirebaseStorageProvider');
const ReplitStorageProvider = require('./ReplitStorageProvider');
const { StorageService, getStorageService, DEFAULT_COIN_ICON_PATH, DEFAULT_COIN_ICON_SOURCE } = require('./StorageService');

module.exports = {
  StorageProvider,
  FirebaseStorageProvider,
  ReplitStorageProvider,
  StorageService,
  getStorageService,
  DEFAULT_COIN_ICON_PATH,
  DEFAULT_COIN_ICON_SOURCE
};
