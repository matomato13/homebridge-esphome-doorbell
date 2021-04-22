import EventSource from "eventsource";
import fetch from "node-fetch";

export interface EspHomeStateEventData {
  id: string;
  state: string;
  value: object;
}

export class EspHomeWebApi {
  private baseUrl: string;
  private eventSource: EventSource;

  constructor(host: string, port: number) {
    this.baseUrl = `http://${host}:${port}`;
    this.eventSource = new EventSource(this.baseUrl + '/events');
  }

  stateEvent(callback) {
    console.log('Starting State EventSource listener on', this.eventSource.url);
    this.eventSource.addEventListener('state', (e: any) => {
      try {
        const obj = JSON.parse(e.data);
        callback(obj);
      }
      catch (error: any) {
        callback(new Error(`Could not parse json. ${error}`));
      }
    });
  }

  logEvent(callback) {
    console.log('Starting Log EventSource listener on', this.eventSource.url);
    this.eventSource.addEventListener('log', (e: any) => {
      try {
        const obj = JSON.parse(e.data);
        callback(obj);
      }
      catch (error) {
        callback(new Error(`Could not parse json. ${error}`));
      }
    });
  }

  pingEvent(callback) {
    console.log('Starting Ping EventSource listener on', this.eventSource.url);
    this.eventSource.addEventListener('ping', (e: any) => {
      try {
        const obj = JSON.parse(e.data);
        callback(obj);
      }
      catch (error) {
        callback(new Error(`Could not parse json. ${error}`));
      }
    });
  }

  async sendRequest(url, body, method, callbackSuccess, callbackError) {
    url = this.baseUrl + url;
    console.log(`Send ${method} request [${url}]: ${body}`);

    // Device has to respond within 5 seconds
    fetch(url, { body: body, method: method, timeout: 5 * 1000 })
      .then(response => {
        const json = response.json();
        callbackSuccess(response, json)
      }, (error: any) => {
        if (error.code === 'ENOTFOUND') {
          callbackError(new Error('Could not connect to host'));
        }
        else {
          callbackError(error);
        }
      });
  }

  sendRequestJson(url, body, method, callbackSuccess, callbackError) {
    this.sendRequest(url, body, method,
      (response, body) => {
        try {
          const obj = JSON.parse(body);
          callbackSuccess(response, obj);
        }
        catch (error) {
          callbackError(new Error(`Could not parse json. ${error}`));
        }
      },
      (error) => {
        callbackError(error);
      }
    );
  }
}