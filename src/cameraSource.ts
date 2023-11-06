import {
  API,
  CameraStreamingDelegate,
  H264Level,
  H264Profile,
  Logger,
  PrepareStreamCallback,
  PrepareStreamRequest,
  PrepareStreamResponse,
  SnapshotRequest,
  SnapshotRequestCallback,
  SRTPCryptoSuites,
  StreamingRequest,
  StreamRequestCallback,
} from 'homebridge';
import ip from 'ip';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export class CameraSource implements CameraStreamingDelegate {
  private readonly api: API;
  private readonly log: Logger;

  constructor(api: API, log: Logger) {
    this.api = api;
    this.log = log;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public getController(): any {
    return new this.api.hap.CameraController({
      cameraStreamCount: 10,
      delegate: this,
      streamingOptions: {
        supportedCryptoSuites: [SRTPCryptoSuites.AES_CM_128_HMAC_SHA1_80],
        video: {
          resolutions: [
            [1280, 720, 30],
            [1024, 768, 30],
            [640, 480, 30],
            [640, 360, 30],
            [480, 360, 30],
            [480, 270, 30],
            [320, 240, 30],
            [320, 240, 15], // Apple Watch requires this configuration
            [320, 180, 30],
          ],
          codec: {
            profiles: [H264Profile.BASELINE],
            levels: [H264Level.LEVEL3_1],
          },
        },
      },
    });
  }

  async handleSnapshotRequest(request: SnapshotRequest, callback: SnapshotRequestCallback) {
    try {
      this.log.debug('CameraSource handleSnapshotRequest');

      const snapshot = await this.getCurrentSnapshot();

      if (!snapshot) {
        // return an error to prevent "empty image buffer" warnings
        return callback(new Error('No Snapshot Cached'));
      }

      // Not currently resizing the image.
      // HomeKit does a good job of resizing and doesn't seem to care if it's not right
      callback(undefined, snapshot);
    } catch (e) {
      this.log.error(e);
      callback(e);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  handleStreamRequest(request: StreamingRequest, callback: StreamRequestCallback): void {
    this.log.debug('CameraSource handleStreamRequest');
    callback(undefined);
  }

  prepareStream(request: PrepareStreamRequest, callback: PrepareStreamCallback): void {
    this.log.debug('CameraSource prepareStream called');

    const response: PrepareStreamResponse = {
      address: ip.address('public', request.addressVersion),
      video: undefined,
    };

    const videoInfo = request.video;
    if (videoInfo) {
      const targetPort = videoInfo.port;
      const srtpKey = videoInfo.srtp_key;
      const srtpSalt = videoInfo.srtp_salt;

      // SSRC is a 32 bit integer that is unique per stream
      const ssrcSource = crypto.randomBytes(4);
      ssrcSource[0] = 0;
      const ssrc = ssrcSource.readInt32BE(0);

      response.video = {
        port: targetPort,
        ssrc: ssrc,
        srtp_key: srtpKey,
        srtp_salt: srtpSalt,
      };
    }

    this.log.debug('CameraSource prepareStream', response);

    callback(undefined, response);
  }

  private async getCurrentSnapshot(): Promise<Buffer> {
    return fs.readFileSync(path.resolve(__dirname, './front-door.jpg'));
  }
}