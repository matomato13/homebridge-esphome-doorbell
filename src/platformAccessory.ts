import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { EspHomeDoorbellPlatform, IEsphomePlatformDevice } from './platform';
import { EspHomeWebApi, EspHomeStateEventData } from './esphome_webapi';
import fetch from 'node-fetch';
import { CameraSource } from './cameraSource';

export interface DoorbellAccessoryContext {
  device: IEsphomePlatformDevice;
}

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class DoorbellAccessory {
  private service: Service;
  private espHomeWebApi: EspHomeWebApi;
  private isMute: boolean;

  constructor(
    private readonly platform: EspHomeDoorbellPlatform,
    private readonly accessory: PlatformAccessory<DoorbellAccessoryContext>,
    private readonly cameraSource: CameraSource | undefined,
  ) {

    this.espHomeWebApi = new EspHomeWebApi(this.platform.log, accessory.context.device.host, accessory.context.device.port!);

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'EspHome')
      .setCharacteristic(this.platform.Characteristic.Model, 'ESP8266')
      .setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name!);

    if (this.cameraSource) {
      this.accessory.configureController(this.cameraSource.getController());
    }

    // get the Doorbell service if it exists, otherwise create a new Doorbell service
    // you can create multiple services for each accessory
    this.service = this.accessory.getService(this.platform.Service.Doorbell) || this.accessory.addService(this.platform.Service.Doorbell);

    this.espHomeWebApi.stateEvent((event: EspHomeStateEventData) => this.handleEvent(event));

    // register handlers for the Mute Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.Mute)
      .onSet(this.setMute.bind(this))
      .onGet(this.getMute.bind(this));
  }

  private handleEvent(event: EspHomeStateEventData) {
    this.platform.log.debug(`[ES][${this.accessory.context.device.name}] State event:`, event);

    if (this.isDoorbellButton(event.id)) {
      if (event.value) {
        this.platform.log.info('Doorbell activated');
        this.service.getCharacteristic(this.platform.Characteristic.ProgrammableSwitchEvent)
          .updateValue(this.platform.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS);
      }
    }

    if (this.isDoorbellChimeActiveSwitch(event.id)) {
      const isActive = event.value as boolean;
      const isMute = !isActive;
      this.platform.log.info(`Doorbell chime active changed to ${isActive}`);
      this.service.updateCharacteristic(this.platform.Characteristic.Mute, isMute as CharacteristicValue);
      this.isMute = isMute;
    }
  }

  async setMute(value: CharacteristicValue) {
    this.platform.log.debug('Set Characteristic Mute ->', value);

    const isMuting = value as boolean;
    const requestUrl = isMuting
      ? '/switch/doorbell_chime_active/turn_off'
      : '/switch/doorbell_chime_active/turn_on';

    fetch(requestUrl, { method: 'POST' })
      .then(() => {
        this.isMute = isMuting;
      })
      .catch(err => this.platform.log.error(`Error occurred while changing chime state: ${err}`));
  }

  async getMute(): Promise<CharacteristicValue> {
    this.platform.log.debug('Get Characteristic Mute ->', this.isMute);
    return this.isMute;
  }

  private isDoorbellButton(eventId: string): boolean {
    return eventId === 'binary_sensor-doorbell_button';
  }

  private isDoorbellChimeActiveSwitch(eventId: string): boolean {
    return eventId === 'switch-doorbell_chime_active';
  }
}
