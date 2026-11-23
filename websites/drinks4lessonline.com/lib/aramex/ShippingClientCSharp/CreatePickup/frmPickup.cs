using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Windows.Forms;
using ShippingClientCSharp.ShippingReference;

namespace ShippingClientCSharp.CreatePickup
{
    public partial class frmPickup : Form
    {
        public frmPickup()
        {
            InitializeComponent();
        }

        #region "Members"
        private List<PickupItemDetail> _PickupItems = new List<PickupItemDetail>();
        private List<Shipment> _Shipments = null;
        #endregion

        #region "Methods"
        private void FillItems()
        {
            lvPickupItems.Items.Clear();
            if ((_PickupItems != null && _PickupItems.Count > 0))
            {
                foreach (PickupItemDetail _PickupItem in _PickupItems)
                {
                    ListViewItem _Item = new ListViewItem();
                    _Item.Text = _PickupItem.ProductGroup;
                    _Item.SubItems.Add(_PickupItem.ProductType);
                    _Item.SubItems.Add(_PickupItem.Payment);
                    _Item.SubItems.Add(_PickupItem.PackageType);
                    _Item.SubItems.Add(_PickupItem.NumberOfShipments.ToString());
                    _Item.SubItems.Add(_PickupItem.NumberOfPieces.ToString());
                    if ((_PickupItem.ShipmentWeight != null))
                    {
                        _Item.SubItems.Add(_PickupItem.ShipmentWeight.Value.ToString() + " " + _PickupItem.ShipmentWeight.Unit);
                    }
                    else
                    {
                        _Item.SubItems.Add(string.Empty);
                    }
                    if ((_PickupItem.ShipmentVolume != null))
                    {
                        _Item.SubItems.Add(_PickupItem.ShipmentVolume.Value.ToString() + " " + _PickupItem.ShipmentVolume.Unit);
                    }
                    else
                    {
                        _Item.SubItems.Add(string.Empty);
                    }
                    if ((_PickupItem.CashAmount != null))
                    {
                        _Item.SubItems.Add(_PickupItem.CashAmount.Value.ToString() + " " + _PickupItem.CashAmount.CurrencyCode);
                    }
                    else
                    {
                        _Item.SubItems.Add(string.Empty);
                    }
                    if ((_PickupItem.ExtraCharges != null))
                    {
                        _Item.SubItems.Add(_PickupItem.ExtraCharges.Value.ToString() + " " + _PickupItem.ExtraCharges.CurrencyCode);
                    }
                    else
                    {
                        _Item.SubItems.Add(string.Empty);
                    }
                    if ((_PickupItem.ShipmentDimensions != null))
                    {
                        _Item.SubItems.Add(_PickupItem.ShipmentDimensions.Length.ToString() + " x " + _PickupItem.ShipmentDimensions.Width.ToString() + " x " + _PickupItem.ShipmentDimensions.Height.ToString() + " " + _PickupItem.ShipmentDimensions.Unit);
                    }
                    else
                    {
                        _Item.SubItems.Add(string.Empty);
                    }
                    _Item.SubItems.Add(_PickupItem.Comments);

                    lvPickupItems.Items.Add(_Item);
                }
            }
        }

        private void btnPickupDetailAdd_Click(System.Object sender, System.EventArgs e)
        {
            Cursor.Current = Cursors.WaitCursor;

            PickupItemDetail _PickupItem = new PickupItemDetail();
            _PickupItem.ProductGroup = txtPickupItemDetailProductGroup.Text.Trim();
            _PickupItem.ProductType = txtPickupItemDetailProductType.Text.Trim();
            _PickupItem.Payment = txtPickupItemDetailPaymentType.Text.Trim();
            _PickupItem.PackageType = txtPickupItemDetailPackageType.Text.Trim();
            _PickupItem.NumberOfShipments = Convert.ToInt32(nudPickupItemDetailNumberOfShipments.Value);
            _PickupItem.NumberOfPieces = Convert.ToInt32(nudPickupItemDetailNumberOfPieces.Value);
            if ((nudPickupItemDetailWeight.Value != 0 && cmbPickupItemDetailWeightUnit.SelectedIndex != -1))
            {
                _PickupItem.ShipmentWeight = new Weight();
                _PickupItem.ShipmentWeight.Value = Convert.ToDouble(nudPickupItemDetailWeight.Value);
                _PickupItem.ShipmentWeight.Unit = cmbPickupItemDetailWeightUnit.Text;
            }
            if ((nudPickupItemDetailVolume.Value != 0 && cmbPickupItemDetailVolumeUnit.SelectedIndex != -1))
            {
                _PickupItem.ShipmentVolume = new Volume();
                _PickupItem.ShipmentVolume.Value = Convert.ToDouble(nudPickupItemDetailVolume.Value);
                _PickupItem.ShipmentVolume.Unit = cmbPickupItemDetailVolumeUnit.Text;
            }
            if ((nudPickupItemDetailCashAmount.Value != 0 && !string.IsNullOrEmpty(txtPickupItemDetailCashAmountCurrency.Text)))
            {
                _PickupItem.CashAmount = new Money();
                _PickupItem.CashAmount.Value = Convert.ToDouble(nudPickupItemDetailCashAmount.Value);
                _PickupItem.CashAmount.CurrencyCode = txtPickupItemDetailCashAmountCurrency.Text.Trim();
            }
            if ((nudPickupItemDetailExtraCharges.Value != 0 && !string.IsNullOrEmpty(txtPickupItemDetailExtraChargesCurrency.Text)))
            {
                _PickupItem.ExtraCharges = new Money();
                _PickupItem.ExtraCharges.Value = Convert.ToDouble(nudPickupItemDetailExtraCharges.Value);
                _PickupItem.ExtraCharges.CurrencyCode = txtPickupItemDetailExtraChargesCurrency.Text.Trim();
            }
            _PickupItem.ShipmentDimensions = new Dimensions();
            _PickupItem.ShipmentDimensions.Length = Convert.ToDouble(nudPickupItemDetailLength.Value);
            _PickupItem.ShipmentDimensions.Width = Convert.ToDouble(nudPickupItemDetailWidth.Value);
            _PickupItem.ShipmentDimensions.Height = Convert.ToDouble(nudPickupItemDetailHeight.Value);
            _PickupItem.ShipmentDimensions.Unit = cmbPickupItemDetailUnit.Text;
            _PickupItem.Comments = txtPickupItemDetailComments.Text.Trim();

            _PickupItems.Add(_PickupItem);
            FillItems();

            txtPickupItemDetailProductGroup.Text = string.Empty;
            txtPickupItemDetailProductType.Text = string.Empty;
            txtPickupItemDetailPaymentType.Text = string.Empty;
            txtPickupItemDetailPackageType.Text = string.Empty;
            nudPickupItemDetailNumberOfShipments.Value = 0;
            nudPickupItemDetailNumberOfPieces.Value = 0;
            nudPickupItemDetailWeight.Value = 0;
            cmbPickupItemDetailWeightUnit.SelectedIndex = -1;
            nudPickupItemDetailVolume.Value = 0;
            cmbPickupItemDetailVolumeUnit.SelectedIndex = -1;
            nudPickupItemDetailCashAmount.Value = 0;
            txtPickupItemDetailCashAmountCurrency.Text = string.Empty;
            nudPickupItemDetailExtraCharges.Value = 0;
            txtPickupItemDetailExtraChargesCurrency.Text = string.Empty;
            nudPickupItemDetailLength.Value = 0;
            nudPickupItemDetailWidth.Value = 0;
            nudPickupItemDetailHeight.Value = 0;
            cmbPickupItemDetailUnit.SelectedIndex = -1;
            txtPickupItemDetailComments.Text = string.Empty;

            txtPickupItemDetailProductGroup.Focus();

            Cursor.Current = Cursors.Default;
        }

        private void btnPickupDetailDelete_Click(System.Object sender, System.EventArgs e)
        {
            Cursor.Current = Cursors.WaitCursor;

            if ((_PickupItems != null && _PickupItems.Count > 0))
            {
                if ((lvPickupItems.SelectedItems.Count > 0))
                {
                    _PickupItems.RemoveAt(lvPickupItems.SelectedItems[0].Index);
                    FillItems();
                }
            }

            Cursor.Current = Cursors.Default;
        }

        private void btnSubmitRequest_Click(System.Object sender, System.EventArgs e)
        {
            Cursor.Current = Cursors.WaitCursor;

            PickupCreationRequest _Request = new PickupCreationRequest();

            //ClientInfo
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

            //Pickup
            _Request.Pickup = new Pickup();

            //PickupContact
            _Request.Pickup.PickupContact = new Contact();
            _Request.Pickup.PickupContact.Department = txtPickupContactDepartment.Text.Trim();
            _Request.Pickup.PickupContact.PersonName = txtPickupContactPersonName.Text.Trim();
            _Request.Pickup.PickupContact.Title = txtPickupContactTitle.Text.Trim();
            _Request.Pickup.PickupContact.CompanyName = txtPickupContactCompanyName.Text.Trim();
            _Request.Pickup.PickupContact.PhoneNumber1 = txtPickupContactPhoneNumber1.Text.Trim();
            _Request.Pickup.PickupContact.PhoneNumber1Ext = txtPickupContactPhoneNumber1Ext.Text.Trim();
            _Request.Pickup.PickupContact.PhoneNumber2 = txtPickupContactPhoneNumber2.Text.Trim();
            _Request.Pickup.PickupContact.PhoneNumber2Ext = txtPickupContactPhoneNumber2Ext.Text.Trim();
            _Request.Pickup.PickupContact.FaxNumber = txtPickupContactFaxNumber.Text.Trim();
            _Request.Pickup.PickupContact.CellPhone = txtPickupContactCellPhone.Text.Trim();
            _Request.Pickup.PickupContact.EmailAddress = txtPickupContactEmailAddress.Text.Trim();
            _Request.Pickup.PickupContact.Type = txtPickupContactType.Text.Trim();

            //PickupAddress
            _Request.Pickup.PickupAddress = new Address();
            _Request.Pickup.PickupAddress.Line1 = txtPickupAddressLine1.Text.Trim();
            _Request.Pickup.PickupAddress.Line2 = txtPickupAddressLine2.Text.Trim();
            _Request.Pickup.PickupAddress.Line3 = txtPickupAddressLine3.Text.Trim();
            _Request.Pickup.PickupAddress.City = txtPickupAddressCity.Text.Trim();
            _Request.Pickup.PickupAddress.StateOrProvinceCode = txtPickupAddressState.Text.Trim();
            _Request.Pickup.PickupAddress.PostCode = txtPickupAddressPostCode.Text.Trim();
            _Request.Pickup.PickupAddress.CountryCode = txtPickupAddressCountry.Text.Trim();

            //ClosingTime
            _Request.Pickup.ClosingTime = dtpPickupClosingTime.Value;

            //Comments
            _Request.Pickup.Comments = txtPickupComments.Text.Trim();

            //LastPickupTime
            _Request.Pickup.LastPickupTime = dtpPickupLatestTime.Value;

            //PickupDate 
            _Request.Pickup.PickupDate = dtpPickupDate.Value;

            //PickupLocation 
            _Request.Pickup.PickupLocation = txtPickupLocation.Text.Trim();

            //ReadyTime 
            _Request.Pickup.ReadyTime = dtpPickupReadyTime.Value;

            //Reference1
            _Request.Pickup.Reference1 = txtPickupReference1.Text.Trim();

            //Reference2
            _Request.Pickup.Reference2 = txtPickupReference2.Text.Trim();

            //Vehicle
            _Request.Pickup.Vehicle = txtPickupVehicle.Text.Trim();

            //Status
            _Request.Pickup.Status = txtPickupStatus.Text.Trim();

            //Items
            _Request.Pickup.PickupItems = _PickupItems.ToArray();

            //Shipments
            _Request.Pickup.Shipments = (_Shipments == null) ? null : _Shipments.ToArray();

            _Request.LabelInfo = null;
            if ((chkbGenerateLabels.Checked))
            {
                _Request.LabelInfo = new LabelInfo();
                _Request.LabelInfo.ReportID = Convert.ToInt32(nudReportID.Value);
                if ((rbReportAsURL.Checked))
                    _Request.LabelInfo.ReportType = "URL";
                if ((rbReportAsFile.Checked))
                    _Request.LabelInfo.ReportType = "RPT";
            }

            PickupCreationResponse _Response = null;
            Service_1_0Client _Client = new Service_1_0Client();

            try
            {
                _Client.Open();
                _Response = _Client.CreatePickup(_Request);
                _Client.Close();

                using (frmPickupCallResponse _frmPickupCallResponse = new frmPickupCallResponse())
                {
                    _frmPickupCallResponse.Response = _Response;
                    _frmPickupCallResponse.ShowDialog(this);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show(ex.Message);
            }

            Cursor.Current = Cursors.Default;
        }

        private void btnAddShipments_Click(System.Object sender, System.EventArgs e)
        {
            using (frmPickupShipments _frmPickupShipments = new frmPickupShipments())
            {
                _frmPickupShipments.Shipments = _Shipments;
                if ((_frmPickupShipments.ShowDialog(this) == DialogResult.OK))
                {
                    _Shipments = _frmPickupShipments.Shipments;
                }
            }
        }

        private void frmPickup_Load(object sender, System.EventArgs e)
        {
            rbReportAsURL.Checked = true;
            chkbGenerateLabels.Checked = false;
            chkbGenerateLabels_CheckedChanged(null, null);
        }

        private void chkbGenerateLabels_CheckedChanged(System.Object sender, System.EventArgs e)
        {
            nudReportID.Enabled = chkbGenerateLabels.Checked;
            rbReportAsFile.Enabled = chkbGenerateLabels.Checked;
            rbReportAsURL.Enabled = chkbGenerateLabels.Checked;
        }
        #endregion

    }
}
