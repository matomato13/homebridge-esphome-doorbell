import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic, Categories } from 'homebridge';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { DoorbellAccessory, DoorbellAccessoryContext } from './platformAccessory';
import { CameraSource } from './cameraSource';

export interface IEsphomePlatformDevice {
  name?: string;
  host: string;
  password?: string;
  port?: number;
}

interface IEsphomePlatformConfig extends PlatformConfig {
    devices?: IEsphomePlatformDevice[];
    debug?: boolean;
}

export class EspHomeDoorbellPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessoriesMap: Map<string, PlatformAccessory<DoorbellAccessoryContext>> =
    new Map<string, PlatformAccessory<DoorbellAccessoryContext>>();

  constructor(
    public readonly log: Logger,
    public readonly config: IEsphomePlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', this.config.name);

    if (!Array.isArray(this.config.devices)) {
      this.log.error('You did not specify a devices array!');
      this.config.devices = [];
    }

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory<DoorbellAccessoryContext>) {
    this.log.info(`Loading accessory from cache: ${accessory.displayName} with uuid: ${accessory.UUID}`);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessoriesMap.set(accessory.UUID, accessory);
    this.log.debug(JSON.stringify(this.accessoriesMap));
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  discoverDevices() {

    // loop over the discovered devices and register each one if it has not already been registered
    for (const device of this.config.devices!) {

      if (!device.name) {
        this.log.info(`Device [${device.host}] has no name configured, using default.`);
        device.name = 'Doorbell';
      }

      if (!device.host) {
        this.log.info(`Device [${device.name}}] has no hostname configured.`);
        continue;
      }

      device.port = device.port || 80;

      // generate a unique id for the accessory this should be generated from
      // something globally unique, but constant, for example, the device serial
      // number or MAC address
      const uuid = this.api.hap.uuid.generate(device.name);

      this.log.debug(`searching for existing accessory with uuid: ${uuid} in ${JSON.stringify(this.accessoriesMap)}`);

      const cameraSource = !this.api.hap.CameraController
        ? null
        : new CameraSource(this.api, this.log);

      // see if an accessory with the same uuid has already been registered and restored from
      // the cached devices we stored in the `configureAccessory` method above
      const existingAccessory = this.accessoriesMap.get(uuid);

      if (existingAccessory) {
        // the accessory already exists
        this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

        // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
        // existingAccessory.context.device = device;
        // this.api.updatePlatformAccessories([existingAccessory]);

        // create the accessory handler for the restored accessory
        // this is imported from `platformAccessory.ts`
        new DoorbellAccessory(this, existingAccessory, cameraSource);

        // it is possible to remove platform accessories at any time using `api.unregisterPlatformAccessories`, eg.:
        // remove platform accessories when no longer present
        // this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
        // this.log.info('Removing existing accessory from cache:', existingAccessory.displayName);
      } else {
        // the accessory does not yet exist, so we need to create it
        this.log.info('Adding new accessory:', device.name);

        // create a new accessory
        const accessory = new this.api.platformAccessory<DoorbellAccessoryContext>(device.name, uuid, Categories.VIDEO_DOORBELL);

        // store a copy of the device object in the `accessory.context`
        // the `context` property can be used to store any data about the accessory you may need
        accessory.context.device = device;

        // create the accessory handler for the newly create accessory
        // this is imported from `platformAccessory.ts`
        new DoorbellAccessory(this, accessory, cameraSource);

        // link the accessory to your platform
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    }
  }
}
