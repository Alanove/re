using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Windows.Forms;
using ShippingClientCSharp.ShippingReference;

namespace ShippingClientCSharp.CancelPickup
{
    public partial class frmCancelPickup : Form
    {
        public frmCancelPickup()
        {
            InitializeComponent();
        }

        private void btnReset_Click(System.Object sender, System.EventArgs e)
        {
            Cursor.Current = Cursors.WaitCursor;

            txtPickupGUID.Text = string.Empty;
            txtComments.Text = string.Empty;

            Cursor.Current = Cursors.Default;
        }

        private void btnSubmitRequest_Click(System.Object sender, System.EventArgs e)
        {
            Cursor.Current = Cursors.WaitCursor;

            PickupCancelationRequest _Request = new PickupCancelationRequest();

            //ClientInfo
            _Request.ClientInfo = new ClientInfo();
            _Request.ClientInfo = new ClientInfo();
            _Request.ClientInfo.AccountCountryCode = txtAccountCountryCode.Text.Trim();
            _Request.ClientInfo.AccountEntity = txtAccountEntity.Text.Trim();
            _Request.ClientInfo.AccountNumber = txtAccountNumber.Text.Trim();
            _Request.ClientInfo.AccountPin = txtAccountPin.Text.Trim();
            _Request.ClientInfo.UserName = txtUsername.Text.Trim();
            _Request.ClientInfo.Password = txtPassword.Text.Trim();
            _Request.ClientInfo.Version = txtVersion.Text.Trim();

            //Transaction
            _Request.Transaction = new Transaction();
            _Request.Transaction.Reference1 = txtReference1.Text.Trim();
            _Request.Transaction.Reference2 = txtReference2.Text.Trim();
            _Request.Transaction.Reference3 = txtReference3.Text.Trim();
            _Request.Transaction.Reference4 = txtReference4.Text.Trim();
            _Request.Transaction.Reference5 = txtReference5.Text.Trim();

            _Request.PickupGUID = txtPickupGUID.Text.Trim();
            _Request.Comments = txtComments.Text.Trim();

            PickupCancelationResponse _Response = null;
            Service_1_0Client _Client = new Service_1_0Client();

            try
            {
                _Client.Open();
                _Response = _Client.CancelPickup(_Request);
                _Client.Close();

                using (frmCancelPickupCallResponse _frmCancelPickupCallResponse = new frmCancelPickupCallResponse())
                {
                    _frmCancelPickupCallResponse.Response = _Response;
                    _frmCancelPickupCallResponse.ShowDialog(this);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show(ex.Message);
            }

            Cursor.Current = Cursors.Default;
        }

    }
}
