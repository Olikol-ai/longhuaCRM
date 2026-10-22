import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

function mockHost(response: { status: jest.Mock; json: jest.Mock }): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({}),
    }),
  } as unknown as ArgumentsHost;
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  it('maps Multer/client "Request aborted" to 499 with a clear message', () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    filter.catch(new Error('Request aborted'), mockHost({ status, json }));
    expect(status).toHaveBeenCalledWith(499);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 499,
        message: expect.stringMatching(/прервалась/i),
      }),
    );
  });

  it('keeps HttpException status unchanged', () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    filter.catch(
      new HttpException({ message: 'nope' }, HttpStatus.BAD_REQUEST),
      mockHost({ status, json }),
    );
    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
  });
});
